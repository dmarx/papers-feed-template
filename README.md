# Research Paper Visit/Reading Monitor and Feed

System which passively monitors what you're reading via a browser extension and publishes a feed via gh-pages.

Example feed: https://dmarx.github.io/papers-feed/

# How it works

1. Browser extension monitors your reading habits.
2. Interactions with domains you are interested in get logged as github issues. Whole separate project for this cursed use of gh-issues here: https://github.com/dmarx/gh-store
   * Domains supported out of the box:
     * arxiv
     * openreview
   * Can also manually trigger extension to log any page via a popup
4. Github automation workflows update an interactive webpage.

# How to set this up to monitor your own reading

1. Create a new repository from the template here: https://github.com/dmarx/papers-feed-template
2. Configure repository settings
  * [Configure github pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-from-a-branch) to deploy from the `gh-pages` branch
  * Give actions write permissions on your repo
3. [Install the browser extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) located in `papers-feed-src/extension`
4. [Create a a github PAT](https://github.blog/security/application-security/introducing-fine-grained-personal-access-tokens-for-github/#creating-personal-access-tokens) with permission to create issues on your papers-feed repo
5. Register the PAT in the browser extension's options

To test that everything is set up correctly, visit an arxiv `/abs/` or `/pdf/` page. Shortly after visiting:
  * an issue with a bunch of labels should be created
  * this should also trigger activity which will be logged in the repository's `Actions` tab
  * after a few minutes, the frontend should be available via gh-pages at `<username>.github.io/<repo-name>`

# Acknowledgements

* Thank you to anthropic for making a decent LLM (I made claude write nearly all of this)
* Thank you also to https://github.com/utterance/utterances, which inspired how this project (ab)uses github issues as a database
