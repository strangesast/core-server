import { Application, NotFoundException } from "https://deno.land/x/abc@v1.0.0-rc8/mod.ts"; // eslint-disable-line
import { validateJwt } from "https://deno.land/x/djwt/validate.ts"
import { makeJwt, setExpiration, Jose, Payload} from "https://deno.land/x/djwt/create.ts"
import { config } from "https://deno.land/x/dotenv/mod.ts"

const {PORT,SECRET} = config();

const app = new Application();

const header: Jose = {
  alg: "HS256",
  typ: "JWT",
}

interface UserPayload {
  username: string;
  password: string;
}

app
  .post('/user', async (c) => {
    const { username, password } = await c.body<UserPayload>();
    const payload = {
      iss: "joe",
      sub: username,
      exp: setExpiration(new Date().getTime() + 60000),
    }
    const token = makeJwt({ header, payload, key: SECRET });
    return {token};
  })
  .get("/user", async (c) => {
    const authorization = c.request.headers.get('authorization');

    if (authorization != null && authorization.startsWith('bearer ')) {
      const jwt = authorization.slice(7).trim();
      const token = await validateJwt(jwt, SECRET, { isThrowing: false });
      if (token) {
        // lookup user
        return {token};
      }
    }

    throw new NotFoundException("Not found");
  })
  .start({ port: +PORT });
