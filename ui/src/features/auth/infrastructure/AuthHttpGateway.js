export class AuthHttpGateway {
  constructor({ httpClient }) {
    this.httpClient = httpClient;
  }

  currentUser() {
    return this.httpClient.get('/api/auth/me');
  }

  login(credentials) {
    return this.httpClient.post('/api/auth/login', credentials);
  }

  register(credentials) {
    return this.httpClient.post('/api/auth/register', credentials);
  }
}
