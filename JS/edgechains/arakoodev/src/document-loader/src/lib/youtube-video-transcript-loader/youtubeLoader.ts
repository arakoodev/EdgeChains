import { YoutubeTranscript } from "youtube-transcript"

export class YoutubeLoader {
    private videoUrl: string;
    private transcript: YoutubeTranscript[] | null;

    constructor(videoUrl: string) {
        this.videoUrl = videoUrl;
        this.transcript = null;
    }

    async loadTranscript() {
        this.transcript = await YoutubeTranscript.fetchTranscript(this.videoUrl);
        return this.transcript.map((t: any) => t.text).join(" ");
    }
}