import { Hono } from "hono";
import { readFileSync, writeFileSync, STDIO } from "javy/fs";
const app = new Hono();

// function writeOutput(output) {
//     const encodedOutput = new TextEncoder().encode(output);
//     const buffer = new Uint8Array(encodedOutput);
//     // Stdout file descriptor
//     writeFileSync(STDIO.Stdout, buffer);
// }

app.get("/hello", (c) => {
    return c.text("Hello World");
});

app.get("/post", async (c) => {
    try {
        let response = await fetch("https://jsonplaceholder.typicode.com/posts", {
            method: "POST",
            body: JSON.stringify({
                title: "foo",
                body: "bar",
                userId: 1,
            }),
            headers: {
                "Content-type": "application/json",
            },
        });
        return c.json(response);
    } catch (error) {
        console.log("error occured");
        console.log(error);
        return c.json(output);
    }
});

app.get("/get", async (c) => {
    try {
        let response = await fetch("https://jsonplaceholder.typicode.com/todos/1");
        let body = await response.json();
        return c.json(body);
    } catch (error) {
        console.log("error occured");
        console.log(error);
        return c.json(output);
    }
});

app.get("/put", async (c) => {
    try {
        let response = await fetch("https://jsonplaceholder.typicode.com/posts/1", {
            method: "PUT",
            body: JSON.stringify({
                id: 1,
                title: "foo",
                body: "bar",
                userId: 1,
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8",
            },
        });
        return c.json(response);
    } catch (error) {
        console.log("error occured");
        console.log(error);
        return c.json(output);
    }
});

app.get("/delete", async (c) => {
    try {
        let response = await fetch("https://jsonplaceholder.typicode.com/posts/1", {
            method: "DELETE",
        });
        return c.json(response);
    } catch (error) {
        console.log("error occured");
        console.log(error);
        return c.json(output);
    }
});

app.fire();
