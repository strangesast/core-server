const { gql } = require('apollo-server-express');

export const typeDefs = gql`
  scalar Date
  type Query {
    hello: String
  }
  type Employee {
    id: ID!
    firstName: String
    lastName: String
  }
  type Punch {
    id: ID!
    date: Date
  }
  type Shift {
    id: ID!
    startDate: Date
    endDate: Date
    employeeId: Number
    date: Date
    pollDate: Date
    punches: [Punch]
  }
`;


export * from './employee';
