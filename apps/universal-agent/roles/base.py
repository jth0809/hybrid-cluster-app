import time
from termcolor import cprint

class BaseAgent:
    def __init__(self, name="Agent"):
        self.name = name

    def log(self, message, color="white"):
        cprint(f"[{self.name}] {message}", color)

    def run(self):
        """Main loop override"""
        raise NotImplementedError
