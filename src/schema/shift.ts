import { gql } from 'apollo-server-express';

export default gql`
  extend type Query {
    shifts: [Shift!]
  }

  type Shift {
    id: ID!
    employeeId: Int!
    date: Date
    pollDate: Date
  }
`
