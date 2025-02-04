// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { BatchServiceClient } from '@azure/batch';
import { CosmosClient, CosmosClientOptions } from '@azure/cosmos';
import * as msRestNodeAuth from '@azure/ms-rest-nodeauth';
import { BlobServiceClient } from '@azure/storage-blob';
import { QueueServiceClient } from '@azure/storage-queue';
import { IoC } from 'common';
import { Container, interfaces } from 'inversify';
import { ContextAwareLogger } from 'logger';
import { SecretClient } from '@azure/keyvault-secrets';
import { Batch } from './azure-batch/batch';
import { BatchConfig } from './azure-batch/batch-config';
import { StorageContainerSASUrlProvider } from './azure-blob/storage-container-sas-url-provider';
import { CosmosClientWrapper } from './azure-cosmos/cosmos-client-wrapper';
import { Queue } from './azure-queue/queue';
import { StorageConfig } from './azure-queue/storage-config';
import { CredentialsProvider } from './credentials/credentials-provider';
import { AuthenticationMethod, CredentialType, MSICredentialsProvider } from './credentials/msi-credential-provider';
import { cosmosContainerClientTypes, iocTypeNames } from './ioc-types';
import { secretNames } from './key-vault/secret-names';
import { SecretProvider } from './key-vault/secret-provider';
import { CosmosContainerClient } from './storage/cosmos-container-client';

export function registerAzureServicesToContainer(
    container: Container,
    credentialType: CredentialType = CredentialType.VM,
    cosmosClientFactory: (options: CosmosClientOptions) => CosmosClient = defaultCosmosClientFactory,
): void {
    setupAuthenticationMethod(container);

    container.bind(iocTypeNames.msRestAzure).toConstantValue(msRestNodeAuth);
    container.bind(CredentialsProvider).toSelf().inSingletonScope();

    setupSingletonAzureKeyVaultClientProvider(container);

    container.bind(SecretProvider).toSelf().inSingletonScope();

    container.bind(StorageConfig).toSelf().inSingletonScope();

    setupSingletonCosmosClientProvider(container, cosmosClientFactory);

    container.bind(CosmosClientWrapper).toSelf();
    container.bind(MSICredentialsProvider).toSelf().inSingletonScope();

    setupSingletonQueueServiceClientProvider(container);

    container.bind(cosmosContainerClientTypes.OnDemandScanBatchRequestsCosmosContainerClient).toDynamicValue((context) => {
        return createCosmosContainerClient(context.container, 'onDemandScanner', 'scanBatchRequests');
    });

    container.bind(cosmosContainerClientTypes.OnDemandScanRunsCosmosContainerClient).toDynamicValue((context) => {
        return createCosmosContainerClient(context.container, 'onDemandScanner', 'scanRuns');
    });

    container.bind(cosmosContainerClientTypes.OnDemandScanRequestsCosmosContainerClient).toDynamicValue((context) => {
        return createCosmosContainerClient(context.container, 'onDemandScanner', 'scanRequests');
    });

    container.bind(cosmosContainerClientTypes.OnDemandSystemDataCosmosContainerClient).toDynamicValue((context) => {
        return createCosmosContainerClient(context.container, 'onDemandScanner', 'systemData');
    });

    container.bind(iocTypeNames.CredentialType).toConstantValue(credentialType);

    setupBlobServiceClientProvider(container);
    container.bind(StorageContainerSASUrlProvider).toSelf().inSingletonScope();
    container.bind(Queue).toSelf();

    setupSingletonAzureBatchServiceClientProvider(container);
    container.bind(BatchConfig).toSelf().inSingletonScope();
    container.bind(Batch).toSelf().inSingletonScope();
}

async function getStorageAccountName(context: interfaces.Context): Promise<string> {
    if (process.env.AZURE_STORAGE_NAME !== undefined) {
        return process.env.AZURE_STORAGE_NAME;
    } else {
        const secretProvider = context.container.get(SecretProvider);

        return secretProvider.getSecret(secretNames.storageAccountName);
    }
}

// DefaultAzureCredential will first look for Azure Active Directory (AAD)
// client secret credentials in the following environment variables:
//
// - AZURE_TENANT_ID: The ID of your AAD tenant
// - AZURE_CLIENT_ID: The ID of your AAD app registration (client)
// - AZURE_CLIENT_SECRET: The client secret for your AAD app registration
//
// If those environment variables aren't found and your application is deployed
// to an Azure VM or App Service instance, the managed service identity endpoint
// will be used as a fallback authentication source.
function setupBlobServiceClientProvider(container: interfaces.Container): void {
    IoC.setupSingletonProvider<BlobServiceClient>(iocTypeNames.BlobServiceClientProvider, container, async (context) => {
        const accountName = await getStorageAccountName(context);
        const credentialProvider = container.get(CredentialsProvider);
        const defaultAzureCredential = credentialProvider.getDefaultAzureCredential();

        return new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, defaultAzureCredential);
    });
}

function createCosmosContainerClient(container: interfaces.Container, dbName: string, collectionName: string): CosmosContainerClient {
    return new CosmosContainerClient(container.get(CosmosClientWrapper), dbName, collectionName, container.get(ContextAwareLogger));
}

function setupAuthenticationMethod(container: interfaces.Container): void {
    const isDebugEnabled = /--debug|--inspect/i.test(process.execArgv.join(' '));
    container
        .bind(iocTypeNames.AuthenticationMethod)
        .toConstantValue(isDebugEnabled ? AuthenticationMethod.servicePrincipal : AuthenticationMethod.managedIdentity);
}

function setupSingletonAzureKeyVaultClientProvider(container: interfaces.Container): void {
    IoC.setupSingletonProvider<SecretClient>(iocTypeNames.AzureKeyVaultClientProvider, container, async (context) => {
        const credentialProvider = container.get(CredentialsProvider);
        const credentials = credentialProvider.getDefaultAzureCredential();

        return new SecretClient(process.env.KEY_VAULT_URL, credentials);
    });
}

function setupSingletonQueueServiceClientProvider(container: interfaces.Container): void {
    IoC.setupSingletonProvider<QueueServiceClient>(iocTypeNames.QueueServiceClientProvider, container, async (context) => {
        const accountName = await getStorageAccountName(context);
        const credentialProvider = container.get(CredentialsProvider);
        const credentials = credentialProvider.getDefaultAzureCredential();

        return new QueueServiceClient(`https://${accountName}.queue.core.windows.net`, credentials);
    });
}

function setupSingletonCosmosClientProvider(
    container: interfaces.Container,
    cosmosClientFactory: (options: CosmosClientOptions) => CosmosClient,
): void {
    IoC.setupSingletonProvider<CosmosClient>(iocTypeNames.CosmosClientProvider, container, async (context) => {
        let cosmosDbUrl: string;
        if (process.env.COSMOS_DB_URL !== undefined && process.env.COSMOS_DB_KEY !== undefined) {
            return cosmosClientFactory({ endpoint: process.env.COSMOS_DB_URL, key: process.env.COSMOS_DB_KEY });
        } else {
            const secretProvider = context.container.get(SecretProvider);
            cosmosDbUrl = await secretProvider.getSecret(secretNames.cosmosDbUrl);
            const credentialProvider = container.get(CredentialsProvider);
            const credentials = credentialProvider.getDefaultAzureCredential();

            return cosmosClientFactory({ endpoint: cosmosDbUrl, aadCredentials: credentials });
        }
    });
}

function setupSingletonAzureBatchServiceClientProvider(container: Container): void {
    IoC.setupSingletonProvider(iocTypeNames.BatchServiceClientProvider, container, async (context: interfaces.Context) => {
        const batchConfig = context.container.get(BatchConfig);
        const credentialProvider = context.container.get(CredentialsProvider);

        return new BatchServiceClient(await credentialProvider.getCredentialsForBatch(), batchConfig.accountUrl);
    });
}

function defaultCosmosClientFactory(cosmosClientOptions: CosmosClientOptions): CosmosClient {
    const options = {
        connectionPolicy: {
            requestTimeout: 10000,
        },
        ...cosmosClientOptions,
    };

    return new CosmosClient(options);
}
