const { AwsComprehend } = require("@arakoodev/edgechains.js/ai");

async function awsRedact({ text }: any) {
    try {
        const aws = new AwsComprehend();
        let res = await aws.redact(text);
        return res;
    } catch (error: any) {
        return error.message;
    }
}

module.exports = awsRedact;
