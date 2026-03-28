import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AuthUser {
	email: string;
}

export async function getAuthUser(
	request: Request,
	teamDomain: string,
	aud: string,
): Promise<AuthUser | null> {
	const token = getCookie(request, 'CF_Authorization');
	if (!token) return null;

	try {
		const JWKS = createRemoteJWKSet(
			new URL(`${teamDomain}/cdn-cgi/access/certs`),
		);
		const { payload } = await jwtVerify(token, JWKS, {
			issuer: teamDomain,
			audience: aud,
		});
		if (typeof payload.email !== 'string') return null;
		return { email: payload.email };
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
