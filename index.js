#!/usr/bin/env node

const _ = require("lodash");
const{ DateTime } = require("luxon");
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

	await migrator.CreateGitlabGroupMilestone({
		Group: "bats",
		Title: "production",
		Description: "this is a description,
		StartDate: DateTime.now(),
		DueDate: DateTime.fromISO("2023-01-01"),
		IsClosed: true
	});

	await migrator.CreateGitlabIssue({
		Project: "mocull/demo-project",
		Title: "demo issue",
		Description: "this is a description",
		Assignee: "mocull",
		CreatedTime: DateTime.fromISO("2017-05-15"),
		DueDate: DateTime.fromISO("2019-01-13"),
		Labels: [
			"die",
			"like",
			"rest"
		],
		Milestone: "production",
		IsClosed: "true"
	});

	//Logger.debug("Gitlab issues: %o", await migrator.GetAllGitlabIssues());
	//Logger.debug("Gitbucket issues: %o", await migrator.GetAllGitbucketIssues());
})();
