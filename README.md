# Research Paper Visit/Reading Monitor and Feed

System which monitors what I'm reading via a browser extension and publishes a feed: https://dmarx.github.io/papers-feed/

At present, only arxiv is supported, with plans to support other journals/sources in the future.

# How it works

The system is comprised of the following components:

* https://github.com/dmarx/papers-feed-src
  - repository which contains most of the source code for this system
* https://github.com/dmarx/papers-feed
  - repository used as a data lake
  - pulls in https://github.com/dmarx/papers-feed-src as a submodule
* https://github.com/dmarx/papers-feed-src/tree/main/extension
  * Browser extension which monitors my pageviewing activity
  * When I interact with an arxiv URL, the browser extension logs the interaction to the data lake repo (here) by creating a github issue on it
  * This is possible because I created a PAT narowly scoped to this repository which is registered in the extension's options
* https://github.com/dmarx/papers-feed/.github/workflows
  - Issues are processed by github actions workflows which invoke scripts installed from https://github.com/dmarx/papers-feed-src
  - Data is persisted to https://github.com/dmarx/papers-feed/data
* https://github.com/dmarx/papers-feed-src/src/scripts/frontend
  - Aggregated results are injected into a simple webpage template which is hosted via github pages

# How to set this up to monitor your own reading

1. Create a new repository from the template here: https://github.com/dmarx/papers-feed-template
2. Configure repository settings
  * [Configure github pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-from-a-branch) to deploy from the `gh-pages` branch
  * Give actions write permissions on your repo
3. [Install the browser extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) located in `papers-feed-src/extension`
4. [Create a a github PAT](https://github.blog/security/application-security/introducing-fine-grained-personal-access-tokens-for-github/#creating-personal-access-tokens) with permission to create issues on your papers-feed repo
5. Register the PAT in the browser extension's options

To test that everything is set up correctly, visit an arxiv `/abs/` or `/pdf/` page. Shortly after visiting:
  * an issue with the label "paper" should be created
  * opening that issue should trigger the process-events.yml workflow, which in turn should trigger but build-and-deploy.yml workflow. you should see these activities logged in the repository's `Actions` tab
  * after a few minutes, the frontend should be available via gh-pages at `<username>.github.io/<repo-name>`

# Acknowledgements

* Thank you to anthropic for making a decent LLM (I made claude write nearly all of this)
* Thank you also to https://github.com/utterance/utterances, which inspired how this project (ab)uses github issues as a database
