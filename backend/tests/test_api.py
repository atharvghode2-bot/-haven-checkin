# Comprehensive API tests for authentication, role security, screening flow, and crisis checks.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app
from app.store import get_store


def test_api_full_suite() -> None:
    with TestClient(app) as client:
        # 1. Health check
        h = client.get("/health")
        assert h.status_code == 200
        assert h.json()["ok"] is True

        # 2. Seeded accounts verification
        # Student login
        s_res = client.post("/auth/login", json={"email": "student@haven.edu", "password": "Student123!"})
        assert s_res.status_code == 200, f"Student login failed: {s_res.text}"
        s_data = s_res.json()
        student_token = s_data["token"]
        student_id = s_data["user"]["id"]
        assert s_data["user"]["role"] == "student"
        assert s_data["user"]["anonymous_code"] == "STU-4C91"

        # Counselor login
        c_res = client.post("/auth/login", json={"email": "counselor@haven.edu", "password": "Counselor123!"})
        assert c_res.status_code == 200, f"Counselor login failed: {c_res.text}"
        c_data = c_res.json()
        counselor_token = c_data["token"]
        assert c_data["user"]["role"] == "counselor"

        s_headers = {"Authorization": f"Bearer {student_token}"}
        c_headers = {"Authorization": f"Bearer {counselor_token}"}

        # 3. New student registration
        reg_res = client.post(
            "/auth/register",
            json={
                "email": "newstudent@haven.edu",
                "password": "Password123!",
                "name": "Alex",
                "role": "student",
            },
        )
        assert reg_res.status_code == 200
        new_student_data = reg_res.json()
        new_token = new_student_data["token"]
        new_id = new_student_data["user"]["id"]
        new_headers = {"Authorization": f"Bearer {new_token}"}

        # Duplicate email registration rejected
        dup_res = client.post(
            "/auth/register",
            json={"email": "newstudent@haven.edu", "password": "Password123!", "name": "Alex", "role": "student"},
        )
        assert dup_res.status_code == 409

        # Bad password rejected
        bad_pw_res = client.post(
            "/auth/register",
            json={"email": "badpw@haven.edu", "password": "short", "name": "Short", "role": "student"},
        )
        assert bad_pw_res.status_code == 422

        # 4. Role authorization security checks
        # Student cannot access counselor alert list
        alert_forbidden = client.get("/alerts", headers=s_headers)
        assert alert_forbidden.status_code == 403, "Student should not be allowed to access /alerts"

        # Student cannot view another student's trends
        trend_forbidden = client.get(f"/students/{student_id}/trends", headers=new_headers)
        assert trend_forbidden.status_code == 403, "Student should not be allowed to view another student's trends"

        # Counselor CAN access /alerts and student trends
        alerts_ok = client.get("/alerts", headers=c_headers)
        assert alerts_ok.status_code == 200
        assert "alerts" in alerts_ok.json()

        counselor_trend_ok = client.get(f"/students/{student_id}/trends", headers=c_headers)
        assert counselor_trend_ok.status_code == 200

        # 5. Questionnaire check
        q_res = client.get("/questionnaire", headers=new_headers)
        assert q_res.status_code == 200
        items = q_res.json()["items"]
        assert len(items) == 17  # 9 PHQ9 + 7 GAD7 + 1 open

        # 6. Screening flow for low-risk session
        ses_res = client.post("/sessions", json={"camera_consent": False, "voice_consent": False}, headers=new_headers)
        assert ses_res.status_code == 200
        session_id = ses_res.json()["session_id"]

        # Answer all items with 0 (minimal symptoms)
        for it in items:
            ans_body = {"item_id": it["id"]}
            if it["kind"] == "likert":
                ans_body["value"] = 0
            else:
                ans_body["text"] = "I feel calm and well rested."
            ans_res = client.post(f"/sessions/{session_id}/answer", json=ans_body, headers=new_headers)
            assert ans_res.status_code == 200
            assert "acknowledgement" in ans_res.json()

        # Check that individual responses were stored
        responses = client.get(f"/sessions/{session_id}", headers=new_headers)
        assert responses.status_code == 200

        # Finish session
        fin_res = client.post(
            f"/sessions/{session_id}/finish",
            json={"idempotency_key": "test-key-1"},
            headers=new_headers,
        )
        assert fin_res.status_code == 200
        fin_data = fin_res.json()["result"]
        assert fin_data["phq9"] == 0
        assert fin_data["gad7"] == 0
        assert fin_data["band"] == "lower"
        assert fin_data["crisis"] is False
        assert fin_data["counselor_notified"] is False
        assert "crisis_resources" in fin_data
        # Verify Tele-MANAS is in crisis resources
        assert any("14416" in r.get("contact", "") for r in fin_data["crisis_resources"])

        # Idempotent finish check
        fin_repeat = client.post(
            f"/sessions/{session_id}/finish",
            json={"idempotency_key": "test-key-1"},
            headers=new_headers,
        )
        assert fin_repeat.status_code == 200
        assert fin_repeat.json()["duplicate"] is True

        # 7. Crisis detection & counselor alert generation
        crisis_ses = client.post("/sessions", json={"camera_consent": False, "voice_consent": False}, headers=new_headers)
        crisis_sid = crisis_ses.json()["session_id"]
        for it in items:
            ans_body = {"item_id": it["id"]}
            if it["kind"] == "likert":
                # For PHQ9 item 9, set to 2 (thoughts of self-harm)
                ans_body["value"] = 2 if it["id"] == "phq9_9" else 1
            else:
                ans_body["text"] = "Things are tough right now."
            ans_res = client.post(f"/sessions/{crisis_sid}/answer", json=ans_body, headers=new_headers)
            assert ans_res.status_code == 200

        crisis_fin = client.post(f"/sessions/{crisis_sid}/finish", json={}, headers=new_headers)
        assert crisis_fin.status_code == 200
        c_res_data = crisis_fin.json()["result"]
        assert c_res_data["crisis"] is True
        assert c_res_data["counselor_notified"] is True
        assert c_res_data["band"] == "elevated"

        # Verify counselor can see this alert
        c_alert_list = client.get("/alerts", headers=c_headers)
        assert c_alert_list.status_code == 200
        alerts = c_alert_list.json()["alerts"]
        matched_alert = next((a for a in alerts if a["session_id"] == crisis_sid), None)
        assert matched_alert is not None
        assert matched_alert["crisis"] is True
        assert matched_alert["status"] == "open"

        # Counselor updates alert status and adds note
        patch_res = client.patch(f"/alerts/{matched_alert['id']}", json={"status": "in_review"}, headers=c_headers)
        assert patch_res.status_code == 200
        assert patch_res.json()["alert"]["status"] == "in_review"

        note_res = client.post(
            f"/alerts/{matched_alert['id']}/notes",
            json={"body": "Contacted campus support team for confidential outreach."},
            headers=c_headers,
        )
        assert note_res.status_code == 200
        assert len(note_res.json()["alert"]["notes"]) == 1

        # 8. Student session history endpoint
        hist_res = client.get("/students/me/sessions", headers=new_headers)
        assert hist_res.status_code == 200
        sessions_list = hist_res.json()["sessions"]
        assert len(sessions_list) >= 2

        # 9. Multi-signal facial emotion detection & aggregation tests
        # A) Session with camera consent and valid aggregated face emotion scores (>= 3 frames)
        cam_ses = client.post("/sessions", json={"camera_consent": True, "voice_consent": False}, headers=new_headers)
        assert cam_ses.status_code == 200
        cam_sid = cam_ses.json()["session_id"]
        for it in items:
            ans_body = {"item_id": it["id"], "value": 0 if it["kind"] == "likert" else None}
            if it["kind"] == "text":
                ans_body["text"] = "Feeling okay today."
            client.post(f"/sessions/{cam_sid}/answer", json=ans_body, headers=new_headers)

        valid_emotions = {
            "neutral": 0.65,
            "happy": 0.20,
            "sad": 0.05,
            "angry": 0.02,
            "fearful": 0.03,
            "surprised": 0.03,
            "disgusted": 0.02,
        }
        cam_fin = client.post(
            f"/sessions/{cam_sid}/finish",
            json={
                "face_emotions": valid_emotions,
                "face_sample_count": 12,
                "face_model_version": "MediaPipe-FaceLandmarker-FACS-v1",
            },
            headers=new_headers,
        )
        assert cam_fin.status_code == 200
        cam_result = cam_fin.json()["result"]
        assert cam_result["face_emotion_score"] is not None
        assert "face" in cam_result["weights_used"]
        assert cam_result["face_sample_count"] == 12
        assert cam_result["face_emotions_breakdown"] is not None
        assert cam_result["face_emotions_breakdown"]["neutral"] == 0.65

        # B) Session with camera consent but insufficient frames (< 3 frames)
        # Should omit face from fusion without inventing a zero score
        low_cam_ses = client.post("/sessions", json={"camera_consent": True, "voice_consent": False}, headers=new_headers)
        low_sid = low_cam_ses.json()["session_id"]
        for it in items:
            client.post(f"/sessions/{low_sid}/answer", json={"item_id": it["id"], "value": 0 if it["kind"] == "likert" else None, "text": "Testing" if it["kind"] == "text" else None}, headers=new_headers)
        low_fin = client.post(
            f"/sessions/{low_sid}/finish",
            json={"face_emotions": valid_emotions, "face_sample_count": 2},
            headers=new_headers,
        )
        assert low_fin.status_code == 200
        low_result = low_fin.json()["result"]
        assert low_result["face_emotion_score"] is None
        assert "face" not in low_result["weights_used"]

        # C) Session where camera was NOT consented: face scores must be ignored
        noconsent_ses = client.post("/sessions", json={"camera_consent": False, "voice_consent": False}, headers=new_headers)
        noconsent_sid = noconsent_ses.json()["session_id"]
        for it in items:
            client.post(f"/sessions/{noconsent_sid}/answer", json={"item_id": it["id"], "value": 0 if it["kind"] == "likert" else None, "text": "Testing" if it["kind"] == "text" else None}, headers=new_headers)
        noconsent_fin = client.post(
            f"/sessions/{noconsent_sid}/finish",
            json={"face_emotions": valid_emotions, "face_sample_count": 10},
            headers=new_headers,
        )
        assert noconsent_fin.status_code == 200
        noconsent_result = noconsent_fin.json()["result"]
        assert noconsent_result["face_emotion_score"] is None
        assert "face" not in noconsent_result["weights_used"]

        print("All API tests passed successfully!")


if __name__ == "__main__":
    test_api_full_suite()
