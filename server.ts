import { Application } from "https://deno.land/x/abc@v1.0.0-rc8/mod.ts"; // eslint-disable-line

const app = new Application();

app
  .get("/hello", (c) => {
    return "Hello, Abc!";
  })
  .start({ port: 8082 });
