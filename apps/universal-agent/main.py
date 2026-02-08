import os
import time
import sys
from termcolor import cprint
from roles.supervisor import SupervisorAgent
from roles.worker import WorkerAgent

def main():
    role = os.getenv("AGENT_ROLE", "worker").lower()
    cprint(f"🤖 Universal Agent Starting... ROLE=[{role.upper()}]", "cyan", attrs=["bold"])

    agent = None
    if role == "supervisor":
        agent = SupervisorAgent()
    elif role == "worker":
        agent = WorkerAgent()
    else:
        cprint(f"❌ Unknown Agent Role: {role}", "red")
        sys.exit(1)

    # Main Loop
    try:
        agent.run()
    except KeyboardInterrupt:
        cprint("\n🛑 Agent stopping...", "yellow")
    except Exception as e:
        cprint(f"\n🔥 Critical Error: {e}", "red")
        sys.exit(1)

if __name__ == "__main__":
    main()
