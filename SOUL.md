# The Soul of the McChicken Index

> The McChicken Index is a novel economic indicator designed to capture real-price changes in American fast food. The index is an analytical signal for investors and economic researchers that reflects the pricing pressures on food spend put on every day Americans. The McChicken Index elaborates on the Economist's Big Mac Index by designing a methodology that incorporates LLM-driven real-time research into the index itself, providing a highly accurate and flexible indicator.

---

**For humans and LLMs working on this project:** the paragraph above is the mission statement of the index. Every design decision — the formula, the data sources, the research agent's scope, the site copy — should be traceable back to it. Three commitments follow from it:

1. **Real-price changes** — the index measures the price of a standard fast-food item *in real terms*, grounded in authoritative economic data (BLS/FRED), not vibes or promotional noise.
2. **A signal for everyday Americans' food spend** — the headline must be simple and honest: a reader should understand in one sentence what the number means for the cost of eating.
3. **LLM-driven research as methodology, not garnish** — a scheduled LLM research agent is the index's price-collection instrument (the AI-native successor to phone surveys and web scraping), operating under fixed written instructions, with its output validated deterministically before anything is published.

This text should be clearly presented on the site (e.g., on the methodology page) and included in the context given to any LLM doing research or development work on the index.
