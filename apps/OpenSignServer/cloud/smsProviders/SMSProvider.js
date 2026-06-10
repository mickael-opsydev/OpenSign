class SMSProvider {
  async sendSMS(phone, message) {
    throw new Error('sendSMS() must be implemented by subclass');
  }
}

export default SMSProvider;
