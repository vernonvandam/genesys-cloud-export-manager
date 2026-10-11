export type GenesysIntegration = {
  user_id: string;
  client_id: string;
  region: string;
  redirect_uri: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type GenesysIntegrationInput = {
  client_id: string;
  region: string;
  redirect_uri: string;
  enabled: boolean;
};