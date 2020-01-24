import { ForbiddenError } from 'apollo-server';
import { combineResolvers, skip } from 'graphql-resolvers';

export function isAuthenticated (parent, args, { me }) {
  return me ? skip : new ForbiddenError('Not authenticated as user.');
}

export const isAdmin = combineResolvers(
  isAuthenticated,
  (parent, args, { me: { roles } }) => roles.includes('ADMIN') ?
    skip :
    new ForbiddenError('Not authorized as admin.'),
);

export async function isMessageOwner(parent, { id }, { models, me }) {
  const message = await models.Message.findById(id);

  if (message.userId != me.id) {
    throw new ForbiddenError('Not authenticated as owner.');
  }

  return skip;
}
