import { GetRequestInfo } from './request-info.decorator';
import { UAParser } from 'ua-parser-js';

// ua-parser-js v2 is ESM-only, so it cannot be require()d by ts-jest.
jest.mock('ua-parser-js', () => ({
  UAParser: jest.fn(() => ({
    getOS: () => ({ name: 'macOS' }),
    getDevice: () => ({ type: 'mobile', vendor: 'Apple', model: 'iPhone' }),
  })),
}));

const mockUAParser = UAParser as unknown as jest.Mock;

const defaultParser = () => ({
  getOS: () => ({ name: 'macOS' }),
  getDevice: () => ({ type: 'mobile', vendor: 'Apple', model: 'iPhone' }),
});

const makeContext = (request: any) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

// createParamDecorator returns a curried param decorator; the real factory is
// stored in the route-args metadata, so register it on a fake handler and pull
// the factory out to invoke it directly with a fake ExecutionContext.
const getFactory = () => {
  class Target {}
  const paramDecorator = GetRequestInfo(undefined);
  paramDecorator(Target.prototype, 'handler', 0);
  const metadata = Reflect.getMetadata('__routeArguments__', Target, 'handler');
  const entry = metadata[Object.keys(metadata)[0]];
  return { factory: entry.factory, data: entry.data };
};

describe('GetRequestInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUAParser.mockImplementation(defaultParser);
  });

  it('builds RequestInfo from ip, user-agent header and the parsed UA', () => {
    const request = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone)' },
    };
    const { factory, data } = getFactory();

    const info = factory(data, makeContext(request));

    expect(info).toEqual({
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (iPhone)',
      device: 'Apple iPhone (macOS)',
    });
    expect(mockUAParser).toHaveBeenCalledWith('Mozilla/5.0 (iPhone)');
  });

  it('falls back to `${os} ${deviceType}` when vendor and model are absent', () => {
    mockUAParser.mockImplementation(() => ({
      getOS: () => ({ name: 'Windows' }),
      getDevice: () => ({}),
    }));
    const request = { ip: '10.0.0.1', headers: {} };
    const { factory, data } = getFactory();

    const info = factory(data, makeContext(request));

    expect(info).toEqual({
      ip: '10.0.0.1',
      userAgent: '',
      device: 'Windows desktop',
    });
  });

  it('handles an unknown OS name', () => {
    mockUAParser.mockImplementation(() => ({
      getOS: () => ({}),
      getDevice: () => ({}),
    }));
    const request = { ip: '10.0.0.1', headers: {} };
    const { factory, data } = getFactory();

    const info = factory(data, makeContext(request));

    expect(info).toEqual({
      ip: '10.0.0.1',
      userAgent: '',
      device: ' desktop',
    });
  });
});
