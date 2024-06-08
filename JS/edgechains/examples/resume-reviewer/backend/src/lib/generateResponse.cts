const path = require("path");
const { OpenAI } = require("@arakoodev/edgechains.js/openai");
import { z } from "zod";
const Jsonnet = require("@arakoodev/jsonnet");
const jsonnet = new Jsonnet();

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const openAIApiKey = JSON.parse(jsonnet.evaluateFile(secretsPath)).openai_api_key;

const openai = new OpenAI({ apiKey: openAIApiKey });

const profileSchema = z.object({
    fullTimeExperienceInMonths: z.number().int().describe("The total full-time work experience in months."),
    fullTimeExperienceInMonthsPoints: z.number().int().describe("The points for full-time work experience."),
    internshipExperienceInMonths: z.number().int().describe("The total internship work experience in months."),
    internshipExperienceInMonthsPoints: z.number().int().describe("The points for internship work experience."),
    projects: z.array(z.object({
        title: z.string().describe("The title of the project."),
        description: z.string().describe("A brief description of the project."),
        githubLink: z.string().url().optional().describe("The GitHub link to the project's repository."),
        liveLink: z.string().url().optional().describe("The live link where the project can be accessed."),
    })).describe("An array of projects the candidate has worked on."),
    projectsPoints: z.number().int().describe("The points for projects."),
    achievements: z.string().describe("A string describing the candidate's achievements."),
    achievementsPoints: z.number().int().describe("The points for achievements."),
    expectedMinPay: z.number().int().describe("The expected minimum pay in integer format."),
    expectedMinPayCurrency: z.string().default('INR').describe("The currency of the expected minimum pay (default is INR)."),
    skills: z.string().describe("A comma-separated list of skills that the candidate has."),
    skillsPoints: z.number().int().describe("The points for skills."),
    leetcodeProfileLink: z.string().url().optional().describe("The link to the candidate's LeetCode profile."),
    codeforcesProfileLink: z.string().url().optional().describe("The link to the candidate's Codeforces profile."),
    hackerrankProfileLink: z.string().url().optional().describe("The link to the candidate's HackerRank profile."),
    githubLink: z.string().url().optional().describe("The link to the candidate's GitHub profile."),
    twitterLink: z.string().url().optional().describe("The link to the candidate's Twitter profile."),
    linkedinLink: z.string().url().optional().describe("The link to the candidate's LinkedIn profile."),
    notes: z.string().max(500).describe("Bullet points describing the candidate's profile, up to a maximum of 5 bullet points and 500 characters."),
    percent: z.number().max(100).min(1).describe("Generate resume percentage out of hundred using the points "),
});

function openAICall() {
    return function (prompt: string) {
        try {
            return openai.zodSchemaResponse({ prompt, schema: profileSchema }).then((res: any) => {
                return JSON.stringify(res);
            });
        } catch (error) {
            return error;
        }
    };
}

module.exports = openAICall;
