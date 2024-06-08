"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const { OpenAI } = require("@arakoodev/edgechains.js/openai");
const zod_1 = require("zod");
const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();
const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;
const openai = new OpenAI({ apiKey: openAIApiKey });
const profileSchema = zod_1.z.object({
    fullTimeExperienceInMonths: zod_1.z.number().int().describe("The total full-time work experience in months."),
    fullTimeExperienceInMonthsPoints: zod_1.z.number().int().describe("The points for full-time work experience."),
    internshipExperienceInMonths: zod_1.z.number().int().describe("The total internship work experience in months."),
    internshipExperienceInMonthsPoints: zod_1.z.number().int().describe("The points for internship work experience."),
    projects: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string().describe("The title of the project."),
        description: zod_1.z.string().describe("A brief description of the project."),
        githubLink: zod_1.z.string().url().optional().describe("The GitHub link to the project's repository."),
        liveLink: zod_1.z.string().url().optional().describe("The live link where the project can be accessed."),
    })).describe("An array of projects the candidate has worked on."),
    projectsPoints: zod_1.z.number().int().describe("The points for projects."),
    achievements: zod_1.z.string().describe("A string describing the candidate's achievements."),
    achievementsPoints: zod_1.z.number().int().describe("The points for achievements."),
    expectedMinPay: zod_1.z.number().int().describe("The expected minimum pay in integer format."),
    expectedMinPayCurrency: zod_1.z.string().default('INR').describe("The currency of the expected minimum pay (default is INR)."),
    skills: zod_1.z.string().describe("A comma-separated list of skills that the candidate has."),
    skillsPoints: zod_1.z.number().int().describe("The points for skills."),
    leetcodeProfileLink: zod_1.z.string().url().optional().describe("The link to the candidate's LeetCode profile."),
    codeforcesProfileLink: zod_1.z.string().url().optional().describe("The link to the candidate's Codeforces profile."),
    hackerrankProfileLink: zod_1.z.string().url().optional().describe("The link to the candidate's HackerRank profile."),
    githubLink: zod_1.z.string().url().optional().describe("The link to the candidate's GitHub profile."),
    twitterLink: zod_1.z.string().url().optional().describe("The link to the candidate's Twitter profile."),
    linkedinLink: zod_1.z.string().url().optional().describe("The link to the candidate's LinkedIn profile."),
    notes: zod_1.z.string().max(500).describe("Bullet points describing the candidate's profile, up to a maximum of 5 bullet points and 500 characters."),
    percent: zod_1.z.number().max(100).min(1).describe("Generate resume percentage out of hundred using the points "),
});
function openAICall() {
    return function (prompt) {
        try {
            return openai.zodSchemaResponse({ prompt, schema: profileSchema }).then((res) => {
                return JSON.stringify(res);
            });
        }
        catch (error) {
            return error;
        }
    };
}
module.exports = openAICall;
