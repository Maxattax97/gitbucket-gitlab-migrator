#!/usr/bin/env node

const _ = require("lodash");
const Migrator = require("./lib/migrator.js");
const Logger = require("./lib/logger.js");
const Package = require("./package.json");

if(!process.env.GITBUCKET_TOKEN)
{
	throw new Error("Must supply GITBUCKET_TOKEN in environment variable");
}
if(!process.env.GITLAB_TOKEN)
{
	throw new Error("Must supply GITLAB_TOKEN in environment variable");
}
if(!process.env.GITBUCKET_URL)
{
	throw new Error("Must supply GITBUCKET_URL in environment variable");
}
if(!process.env.GITLAB_URL)
{
	throw new Error("Must supply GITLAB_URL in environment variable");
}

(async () =>
{
	const migrator = new Migrator();

	Logger.debug("Gitlab issues: %o", await migrator.GetAllGitlabIssues());
	Logger.debug("Gitbucket issues: %o", await migrator.GetAllGitbucketIssues());
})();
