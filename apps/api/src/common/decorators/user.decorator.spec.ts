import { User } from './user.decorator';

describe('User decorator', () => {
  // createParamDecorator returns a curried param decorator; the real factory is
  // stored in the route-args metadata, so register it on a fake handler and pull
  // the factory out to invoke it directly with a fake ExecutionContext.
  const getFactory = () => {
    class Target {}
    const paramDecorator = User(undefined);
    paramDecorator(Target.prototype, 'handler', 0);
    const metadata = Reflect.getMetadata(
      '__routeArguments__',
      Target,
      'handler',
    );
    const entry = metadata[Object.keys(metadata)[0]];
    return { factory: entry.factory, data: entry.data };
  };

  it('returns request.user', () => {
    const user = { id: 'user-1', role: 'ADMIN' };
    const request = { user };
    const context = { switchToHttp: () => ({ getRequest: () => request }) };

    const result = getFactory().factory(undefined, context as any);

    expect(result).toBe(user);
  });
});
