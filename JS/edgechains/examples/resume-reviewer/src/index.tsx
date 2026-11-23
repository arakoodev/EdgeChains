import { Hono } from "hono";
import Home from "./pages/Home.js";
import RankCard from "./components/Ranks.js";
import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { PrismaClient } from "@prisma/client";
import Jsonnet from "@arakoodev/jsonnet";
//@ts-ignore
import createClient from "sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";
import { PdfLoader } from "@arakoodev/edgechains.js/document-loader";

const prisma = new PrismaClient();
const jsonnet = new Jsonnet();
const server = new ArakooServer();
const app = server.createApp();
const __dirname = fileURLToPath(import.meta.url);
const openAICall = createClient(path.join(__dirname, "../lib/generateResponse.cjs"));

app.get("/", (c) => {
    return c.html((<Home />) as string);
});

app.post("/handleResume", async (c) => {
    const { resume, name, email } = await c.req.parseBody();

    //@ts-ignore
    const arrayBuffer = await resume.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const loader = new PdfLoader(buffer);
    const docs = await loader.loadPdf();
    jsonnet.extString("resume", JSON.stringify(docs));
    jsonnet.javascriptCallback("openAICall", openAICall);
    let resumeDetails = jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/main.jsonnet"));

    await prisma.user.create({
        data: {
            email: email as string,
            name: name as string,
            resumeDetails,
        },
    });

    const parsedResumeDetails = await prisma.user.findMany();
    const newResumeArr: any = [];
    for (let index = 0; index < parsedResumeDetails.length; index++) {
        const element = JSON.parse(JSON.parse(parsedResumeDetails[index].resumeDetails));
        const totalPoints =
            element.fullTimeExperienceInMonthsPoints +
            element.internshipExperienceInMonthsPoints +
            element.projectsPoints +
            element.achievementsPoints +
            element.skillsPoints;

        const newResumeObj = {
            ...parsedResumeDetails[index],
            totalPoints,
        };
        newResumeArr.push(newResumeObj);
    }

    const sortedArr = newResumeArr.sort((a: any, b: any) => b.totalPoints - a.totalPoints);
    return c.html(
        (
            <>
                {sortedArr.map((rank: any, index: number) => {
                    return (
                        <RankCard rank={rank} parsedResumeDetails={parsedResumeDetails} i={index} />
                    );
                })}
            </>
        ) as string
    );
});

server.listen(3000);
