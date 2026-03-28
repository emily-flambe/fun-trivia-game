import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AuthUser {
	email: string;
	isServiceToken: boolean;
}

export async function getAuthUser(
	request: Request,
	teamDomain: string,
	aud: string,
): Promise<AuthUser | null> {
	// Service token requests get Cf-Access-Jwt-Assertion header from Cloudflare edge.
	// Cookie-based auth (user login via IdP) uses CF_Authorization cookie.
	const token =
		request.headers.get('cf-access-jwt-assertion') ||
		getCookie(request, 'CF_Authorization');
	if (!token) return null;

	try {
		const JWKS = createRemoteJWKSet(
			new URL(`${teamDomain}/cdn-cgi/access/certs`),
		);
		const { payload } = await jwtVerify(token, JWKS, {
			issuer: teamDomain,
			audience: aud,
		});

		// IdP-authenticated users have email; service tokens have common_name
		if (typeof payload.email === 'string') {
			return { email: payload.email, isServiceToken: false };
		}
		if (typeof payload.common_name === 'string') {
			return { email: payload.common_name, isServiceToken: true };
		}
		return null;
	} catch {
		return null;
	}
}

function getCookie(request: Request, name: string): string | null {
	const header = request.headers.get('cookie');
	if (!header) return null;
	const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? match[1] : null;
}
