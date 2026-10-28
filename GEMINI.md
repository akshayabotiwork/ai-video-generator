# Antigravity Master Execution Rules

## 1. Speed & Fast Responses (Ultra-Fast Delivery)
- Deliver responses rapidly and concisely.
- Do not stall, over-deliberate, or run lengthy exploratory loops.
- Get straight to the solution with minimal overhead.

## 2. No Unsolicited Checks or Internal Executions
- **Strict Constraint**: Do NOT run test commands, curl calls, benchmark probes, or internal test executions unless the user explicitly asks for them.
- Do NOT start background server processes (e.g., `python app.py`) or bind ports unless explicitly commanded by the user.
- Focus strictly on modifying/creating the target code accurately without unrequested validation runs.

## 3. High Code Accuracy with Minimal Code Diffs
- Make surgically precise, minimal code changes.
- Avoid rewriting entire files or adding redundant boilerplate.
- Guarantee 100% syntax and runtime accuracy on the first attempt.

## 4. Direct Action & Communication
- State what was changed concisely in direct, clear language (Hindi/Hinglish or English as preferred by user).
- No unnecessary explanations, fluff, or repetitive confirmations.
