import json, os, glob

home = os.environ.get("USERPROFILE", "C:/Users/Administrator")
pattern = os.path.join(home, ".claude", "projects", "D--AICoding", "*.jsonl")
files = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
if not files:
    print("No transcript files found")
else:
    latest = files[0]
    print(f"Latest transcript: {latest}")
    user_count = 0
    asst_count = 0
    with open(latest, encoding="utf-8") as f:
        for line in f:
            try:
                entry = json.loads(line)
                t = entry.get("type")
                if t == "user":
                    user_count += 1
                    if user_count == 1:
                        msg = entry.get("message", {})
                        print("=== FIRST USER ===")
                        print("message content type:", type(msg).__name__)
                        if isinstance(msg, dict):
                            print("model:", msg.get("model", "NOT_PRESENT"))
                            print("role:", msg.get("role", "NOT_PRESENT"))
                            print("keys:", list(msg.keys()))
                        elif isinstance(msg, str):
                            print("(content is string, preview:", msg[:100], ")")
                elif t == "assistant":
                    asst_count += 1
                    if asst_count == 1:
                        msg = entry.get("message", {})
                        print("=== FIRST ASSISTANT ===")
                        print("message content type:", type(msg).__name__)
                        if isinstance(msg, dict):
                            print("model:", msg.get("model", "NOT_PRESENT"))
                            print("role:", msg.get("role", "NOT_PRESENT"))
                            print("keys:", list(msg.keys()))
                            usage = msg.get("usage", {})
                            if usage:
                                print("usage:", usage)
                        elif isinstance(msg, str):
                            print("(content is string)")
            except:
                pass
    print(f"\nTotal: {user_count} user, {asst_count} assistant entries")
