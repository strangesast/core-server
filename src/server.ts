import http from 'http';
import express from 'express';
import mongoose from 'mongoose';
import { ApolloServer } from 'apollo-server-express';

import { Employee, typeDefs } from './models';

import resolvers from './resolvers';
import schema from './schema';

const apolloServer = new ApolloServer({
   typeDefs: schema,
   resolvers,
});

const app = express();
mongoose.connect('mongodb://localhost:27017/test', {useNewUrlParser: true, useUnifiedTopology: true });

// apolloServer.applyMiddleware({ app });

app.get('/employees', async (req, res) => {
  const employees = await Employee.find();
  res.json({employees});
});

app.use((req, res) => {
  res.send('toast');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).send('Something broke!')
});

const server = http.createServer(app);

const port = 3000;
const host = '0.0.0.0';
server.listen({ host, port }, () => {
  console.log(`Server is listening on ${host}:${port}`);
  // console.log(`Apollo at ${apolloServer.graphqlPath}`)
});
