import {
  BaseSubscriptionFactory,
  type SubscriptionData,
  type UnsubscriptionData,
} from './base-subscription.factory';
import { EProviders } from '../../types';
import { c } from '../../lib/utils';

export class OutlookSubscriptionFactory extends BaseSubscriptionFactory {
  readonly providerId = EProviders.microsoft;

  public async subscribe(data: { body: SubscriptionData }): Promise<Response> {
    const { connectionId } = data.body;
    
    if (!connectionId) {
      return c.json({ error: 'connectionId is required' }, { status: 400 });
    }

    // Stub implementation: Return success without setting up real push notifications
    // This allows accounts to be created and basic email functionality to work
    // but users will need to manually refresh to see new emails
    console.log(`[OUTLOOK SUBSCRIPTION] Stub subscribe called for connection: ${connectionId}`);
    
    // Still initialize labels for the connection so basic functionality works
    await this.initializeConnectionLabels(connectionId);
    
    return c.json({ message: 'Outlook subscription stub - real-time notifications not yet implemented' });
  }

  public async unsubscribe(_: { body: UnsubscriptionData }): Promise<Response> {
    // Stub implementation: Return success (no-op)
    console.log(`[OUTLOOK SUBSCRIPTION] Stub unsubscribe called`);
    return c.json({ message: 'Outlook unsubscription stub' });
  }

  public async verifyToken(_: string): Promise<boolean> {
    // Stub implementation: Return true (basic verification)
    // In a real implementation, this would verify the Microsoft Graph API token
    return true;
  }
}
