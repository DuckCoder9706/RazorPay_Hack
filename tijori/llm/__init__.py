"""LLM boundary (ARCHITECTURE.md §08).

Everything here lives OUTSIDE the scored path: decision narration, Hinglish dunning
copy, and fuzzy recon HINTS only. Calls run at temperature 0 with a response cache so
even this work is reproducible. No function here may influence a scored ₹ figure.
"""
