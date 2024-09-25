import { useEffect } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { EventType, PublicClientApplication } from '@azure/msal-browser';
import { b2cPolicies, protectedResources, msalConfig } from '../authConfig';
import { compareIssuingPolicy } from '../utils/claimUtils';
import '../styles/global.css';

function MyApp({ Component, pageProps }) {

  const instance = new PublicClientApplication(msalConfig);

  useEffect(() => {
    // Ensure the active account is set if none is set on page load
    if (!instance.getActiveAccount() && instance.getAllAccounts().length > 0) {
      instance.setActiveAccount(instance.getAllAccounts()[0]);
    }

    // Event callback handling
    const callbackId = instance.addEventCallback((event) => {
      if (
        (event.eventType === EventType.LOGIN_SUCCESS || event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) &&
        event.payload.account
      ) {
        if (compareIssuingPolicy(event.payload.idTokenClaims, b2cPolicies.names.editProfile)) {
          const originalSignInAccount = instance
            .getAllAccounts()
            .find(
              (account) =>
                account.idTokenClaims.oid === event.payload.idTokenClaims.oid &&
                account.idTokenClaims.sub === event.payload.idTokenClaims.sub &&
                compareIssuingPolicy(account.idTokenClaims, b2cPolicies.names.signUpSignIn)
            );

          let signUpSignInFlowRequest = {
            authority: b2cPolicies.authorities.signUpSignIn.authority,
            account: originalSignInAccount,
          };

          instance.ssoSilent(signUpSignInFlowRequest);
        }

        if (compareIssuingPolicy(event.payload.idTokenClaims, b2cPolicies.names.forgotPassword)) {
          let signUpSignInFlowRequest = {
            authority: b2cPolicies.authorities.signUpSignIn.authority,
            scopes: [
              ...protectedResources.apiTodoList.scopes.read,
              ...protectedResources.apiTodoList.scopes.write,
            ],
          };
          instance.loginRedirect(signUpSignInFlowRequest);
        }
      }

      if (event.eventType === EventType.LOGIN_FAILURE) {
        if (event.error && event.error.errorMessage.includes('AADB2C90118')) {
          const resetPasswordRequest = {
            authority: b2cPolicies.authorities.forgotPassword.authority,
            scopes: [],
          };
          instance.loginRedirect(resetPasswordRequest);
        }
      }
    });

    return () => {
      if (callbackId) {
        instance.removeEventCallback(callbackId);
      }
    };
  }, []);

  return (
    <MsalProvider instance={instance}>
      <Component {...pageProps} />
    </MsalProvider>
  );
}

export default MyApp;
