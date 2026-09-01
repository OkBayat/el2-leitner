export class LeitnerHouseHttpGateway {
  constructor({ httpClient }) {
    this.httpClient = httpClient;
  }

  getHouse(house) {
    return this.httpClient.get(`/api/learning/boxes/${house}`);
  }
}
