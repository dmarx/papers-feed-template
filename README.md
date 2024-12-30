# arxiv-archive

System which monitors what I'm reading via a browser extension and publishes a feed: https://dmarx.github.io/arxiv-archive/

# How it works

1. When I interact with an arxiv URL, the browser extension logs the interaction by creating a github issue on this repo
2. Issues are processed by github actions workflows to log metadata and compute analytics about what I'm reading
3. Aggregated results are injected into a simple webpage template which is hosted via github pages

# How to set this up to monitor your own reading

(coming soon)

# Acknowledgements

* Thank you to anthropic for making a decent LLM (I made claude write nearly all of this)
* Thank you also to https://github.com/utterance/utterances, which inspired how this project uses the github issues feature
