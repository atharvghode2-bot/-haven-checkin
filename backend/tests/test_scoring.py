# Deterministic scoring checks. Run: python tests/test_scoring.py
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.scoring import (  # noqa: E402
    crisis_from_phq9,
    crisis_from_text,
    fuse_scores,
    gad7_total,
    phq9_total,
    questionnaire_score_100,
    should_notify_counselor,
)


def test_totals() -> None:
    answers = {f"phq9_{i}": 1 for i in range(1, 10)}
    answers.update({f"gad7_{i}": 2 for i in range(1, 8)})
    assert phq9_total(answers) == 9
    assert gad7_total(answers) == 14


def test_crisis() -> None:
    assert crisis_from_phq9({"phq9_9": 1})
    assert not crisis_from_phq9({"phq9_9": 0})
    assert crisis_from_text("I want to die")
    assert not crisis_from_text("I feel tired after exams")


def test_fusion_and_face_guard() -> None:
    q = questionnaire_score_100(4, 3)
    fused, weights = fuse_scores(q, 80, 90, True)
    assert "face" in weights
    assert fused <= 100
    assert not should_notify_counselor(fused=80, questionnaire=20, crisis=False, face_used=True)
    assert should_notify_counselor(fused=80, questionnaire=50, crisis=False, face_used=True)
    assert should_notify_counselor(fused=10, questionnaire=10, crisis=True, face_used=False)


if __name__ == "__main__":
    test_totals()
    test_crisis()
    test_fusion_and_face_guard()
    print("scoring tests passed")
