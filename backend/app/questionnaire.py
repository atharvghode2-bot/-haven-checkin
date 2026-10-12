# PHQ-9 and GAD-7 item bank. Scoring is defined in scoring.py, not here.
PHQ9_ITEMS = [
    {
        "id": "phq9_1",
        "instrument": "phq9",
        "prompt": "Over the last 2 weeks, how often have you had little interest or pleasure in doing things?",
    },
    {
        "id": "phq9_2",
        "instrument": "phq9",
        "prompt": "Over the last 2 weeks, how often have you been feeling down, depressed, or hopeless?",
    },
    {
        "id": "phq9_3",
        "instrument": "phq9",
        "prompt": "Over the last 2 weeks, how often have you had trouble falling or staying asleep, or sleeping too much?",
    },
    {
        "id": "phq9_4",
        "instrument": "phq9",
        "prompt": "Over the last 2 weeks, how often have you been feeling tired or having little energy?",
    },
    {
        "id": "phq9_5",
        "instrument": "phq9",
        "prompt": "Over the last 2 weeks, how often have you had a poor appetite or been overeating?",
    },
    {
        "id": "phq9_6",
        "instrument": "phq9",
        "prompt": "Over the last 2 weeks, how often have you been feeling bad about yourself — or that you are a failure or have let yourself or your family down?",
    },
    {
        "id": "phq9_7",
        "instrument": "phq9",
        "prompt": "Over the last 2 weeks, how often have you had trouble concentrating on things, such as reading or watching videos?",
    },
    {
        "id": "phq9_8",
        "instrument": "phq9",
        "prompt": "Over the last 2 weeks, how often have you been moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual?",
    },
    {
        "id": "phq9_9",
        "instrument": "phq9",
        "prompt": "Over the last 2 weeks, how often have you had thoughts that you would be better off dead, or of hurting yourself in some way?",
        "crisis_item": True,
    },
]

GAD7_ITEMS = [
    {
        "id": "gad7_1",
        "instrument": "gad7",
        "prompt": "Over the last 2 weeks, how often have you been feeling nervous, anxious, or on edge?",
    },
    {
        "id": "gad7_2",
        "instrument": "gad7",
        "prompt": "Over the last 2 weeks, how often have you not been able to stop or control worrying?",
    },
    {
        "id": "gad7_3",
        "instrument": "gad7",
        "prompt": "Over the last 2 weeks, how often have you been worrying too much about different things?",
    },
    {
        "id": "gad7_4",
        "instrument": "gad7",
        "prompt": "Over the last 2 weeks, how often have you had trouble relaxing?",
    },
    {
        "id": "gad7_5",
        "instrument": "gad7",
        "prompt": "Over the last 2 weeks, how often have you been so restless that it is hard to sit still?",
    },
    {
        "id": "gad7_6",
        "instrument": "gad7",
        "prompt": "Over the last 2 weeks, how often have you become easily annoyed or irritable?",
    },
    {
        "id": "gad7_7",
        "instrument": "gad7",
        "prompt": "Over the last 2 weeks, how often have you been feeling afraid as if something awful might happen?",
    },
]

OPEN_ITEM = {
    "id": "open_1",
    "instrument": "open",
    "prompt": "Optional: would you like to share anything else about how you have been feeling? You can skip this step.",
    "optional": True,
}

LIKERT_OPTIONS = [
    {"value": 0, "label": "Not at all"},
    {"value": 1, "label": "Several days"},
    {"value": 2, "label": "More than half the days"},
    {"value": 3, "label": "Nearly every day"},
]


def all_items() -> list[dict]:
    return [*PHQ9_ITEMS, *GAD7_ITEMS, OPEN_ITEM]


def item_by_id(item_id: str) -> dict | None:
    for item in all_items():
        if item["id"] == item_id:
            return item
    return None
