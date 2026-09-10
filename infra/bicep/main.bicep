// Provisionnement de l'infrastructure Azure pour Petites annonces (spec §8, Phase 8).
//
// Portée : un groupe de ressources existant (déployer avec
// `az deployment group create`, voir infra/bicep/README.md). Ne provisionne PAS le
// service d'email (SendGrid) : il n'existe plus d'offre Azure Marketplace pour ça,
// créer un compte directement sur sendgrid.com et récupérer une clé API.
//
// Ce fichier n'a pas pu être compilé/validé dans cet environnement (pas d'Azure CLI
// disponible) : avant le premier déploiement réel, lancer
// `az bicep build --file main.bicep` puis `az deployment group what-if` pour
// vérifier la syntaxe et prévisualiser les changements.

@description('Préfixe utilisé pour nommer les ressources (minuscules, sans espace ni caractère spécial).')
param namePrefix string = 'petites-annonces'

@description('Région Azure de déploiement.')
param location string = resourceGroup().location

@description('SKU du plan App Service. B1 recommandé (~13€/mois) ; F1 est gratuit mais limité à 60 min de calcul/jour, à réserver à un test ponctuel.')
param appServicePlanSku string = 'B1'

@description('Identifiant administrateur du serveur Azure SQL (le mot de passe est un paramètre séparé, jamais écrit dans ce fichier).')
param sqlAdminLogin string = 'paadmin'

@secure()
@description('Mot de passe administrateur du serveur Azure SQL — à fournir au déploiement (ex. `az deployment group create ... --parameters sqlAdminPassword=$MOT_DE_PASSE`), jamais commité.')
param sqlAdminPassword string

@description('Chaîne du runtime Linux .NET pour l\'App Service. Si `DOTNETCORE|10.0` n\'apparaît pas encore dans `az webapp list-runtimes --os linux`, utiliser la dernière version disponible en attendant.')
param dotnetLinuxFxVersion string = 'DOTNETCORE|10.0'

// Les noms de compte de stockage et de serveur SQL doivent être uniques au niveau
// mondial : on suffixe avec un hash dérivé de l'ID du groupe de ressources.
var uniqueSuffix = uniqueString(resourceGroup().id)
var appServicePlanName = '${namePrefix}-plan'
var webAppName = '${namePrefix}-api-${uniqueSuffix}'
var sqlServerName = '${namePrefix}-sql-${uniqueSuffix}'
var sqlDatabaseName = '${namePrefix}-db'
var blobContainerName = 'listing-images'
var staticWebAppName = '${namePrefix}-web'

// Compte de stockage : 3-24 caractères alphanumériques minuscules uniquement.
var storageAccountNameRaw = toLower(replace('${namePrefix}st${uniqueSuffix}', '-', ''))
var storageAccountName = length(storageAccountNameRaw) > 24 ? substring(storageAccountNameRaw, 0, 24) : storageAccountNameRaw

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: appServicePlanSku
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: dotnetLinuxFxVersion
      // Pas de compute continu sur le plan gratuit F1 : AlwaysOn y est refusé.
      alwaysOn: appServicePlanSku != 'F1'
      appSettings: [
        { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' }
      ]
    }
  }
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
  }
}

// Autorise les services Azure (dont l'App Service ci-dessus) à joindre le serveur SQL,
// sans ouvrir l'accès à Internet — 0.0.0.0/0.0.0.0 est la plage spéciale reconnue par
// Azure SQL pour ce cas précis (voir doc Microsoft.Sql/servers/firewallRules).
resource sqlAllowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  properties: {
    maxSizeBytes: 2147483648
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    // Les photos d'annonces sont servies directement depuis le blob par le front
    // (pas de proxy via l'API), voir Storage/AzureBlobStorageService.cs.
    allowBlobPublicAccess: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: blobContainerName
  properties: {
    publicAccess: 'Blob'
  }
}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

output webAppName string = webApp.name
output webAppHostName string = webApp.properties.defaultHostName
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDatabaseName
output storageAccountName string = storageAccount.name
output blobContainerName string = blobContainerName
output staticWebAppName string = staticWebApp.name
output staticWebAppHostName string = staticWebApp.properties.defaultHostname
