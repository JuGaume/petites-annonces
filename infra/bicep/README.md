# Infrastructure Azure (Bicep)

Provisionne les ressources Azure nécessaires en production : App Service (API),
Azure SQL (base de données), Storage Account (photos), Static Web App (front).

N'inclut **pas** le service d'email : créer un compte sur
[sendgrid.com](https://sendgrid.com) et récupérer une clé API (pas d'offre Azure
Marketplace pour SendGrid).

> Ce template n'a pas pu être compilé ni déployé dans l'environnement où il a été
> écrit (pas d'Azure CLI disponible). Avant le premier déploiement réel, valider la
> syntaxe (`az bicep build`) et prévisualiser les changements (`az deployment group
> what-if`) comme indiqué ci-dessous.

## Prérequis

- Un compte et un abonnement Azure (le [niveau gratuit](https://azure.microsoft.com/free/)
  suffit pour commencer à tester).
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installé
  (`az bicep` s'installe automatiquement au premier `az bicep build`/`deployment`).

## Déploiement

```bash
az login

# Un groupe de ressources dédié, dans la région de son choix.
az group create --name rg-petites-annonces --location westeurope

# Vérifie la syntaxe du template.
az bicep build --file infra/bicep/main.bicep

# Prévisualise les changements avant de les appliquer (rien n'est créé à cette étape).
az deployment group what-if \
  --resource-group rg-petites-annonces \
  --template-file infra/bicep/main.bicep \
  --parameters infra/bicep/main.parameters.json \
  --parameters sqlAdminPassword='<mot-de-passe-fort>'

# Déploiement réel.
az deployment group create \
  --resource-group rg-petites-annonces \
  --template-file infra/bicep/main.bicep \
  --parameters infra/bicep/main.parameters.json \
  --parameters sqlAdminPassword='<mot-de-passe-fort>'
```

Le mot de passe SQL n'est volontairement pas dans `main.parameters.json` (qui, lui,
est commité) : le passer sur la ligne de commande, ou via une variable
d'environnement (`--parameters sqlAdminPassword=$SQL_ADMIN_PASSWORD`).

## Après le déploiement

La commande `az deployment group create` affiche les `outputs` du template
(`webAppName`, `sqlServerFqdn`, `storageAccountName`, `staticWebAppName`, etc.).
Utiliser ces valeurs pour :

1. **Récupérer le profil de publication de l'App Service** (secret GitHub
   `AZURE_WEBAPP_PUBLISH_PROFILE`) :

   ```bash
   az webapp deployment list-publishing-profiles \
     --name <webAppName> --resource-group rg-petites-annonces --xml
   ```

2. **Récupérer le jeton de déploiement de la Static Web App** (secret GitHub
   `AZURE_STATIC_WEB_APPS_API_TOKEN`) :

   ```bash
   az staticwebapp secrets list \
     --name <staticWebAppName> --resource-group rg-petites-annonces \
     --query "properties.apiKey" -o tsv
   ```

3. **Construire la chaîne de connexion Azure SQL** (secret GitHub
   `AZURE_SQL_CONNECTION_STRING`, utilisée pour appliquer les migrations EF Core) :

   ```
   Server=tcp:<sqlServerFqdn>,1433;Database=<sqlDatabaseName>;User ID=<sqlAdminLogin>;Password=<mot-de-passe-fort>;Encrypt=true;
   ```

4. **Récupérer la chaîne de connexion du Storage Account** (config App Service
   `BlobStorage__AzureConnectionString`) :

   ```bash
   az storage account show-connection-string \
     --name <storageAccountName> --resource-group rg-petites-annonces \
     --query connectionString -o tsv
   ```

5. **Configurer l'App Service** (voir la liste complète des clés dans le README
   racine, section « CI/CD et déploiement Azure ») :

   ```bash
   az webapp config appsettings set \
     --name <webAppName> --resource-group rg-petites-annonces \
     --settings \
       ConnectionStrings__DefaultConnection='<chaîne SQL ci-dessus>' \
       Jwt__SigningKey='<clé générée, voir README>' \
       Jwt__Issuer=petites-annonces-api \
       Jwt__Audience=petites-annonces-web \
       Seed__AdminEmail='<email admin>' \
       Seed__AdminPassword='<mot de passe fort>' \
       Cors__FrontendOrigins__0='https://<staticWebAppHostName>' \
       Frontend__BaseUrl='https://<staticWebAppHostName>' \
       SendGrid__ApiKey='<clé SendGrid>' \
       BlobStorage__AzureConnectionString='<chaîne stockage ci-dessus>' \
       BlobStorage__ContainerName=listing-images
   ```

Une fois ces secrets/variables renseignés côté GitHub (voir README racine), un push
sur `main` déclenche automatiquement `.github/workflows/deploy.yml` : migrations EF
Core + déploiement de l'API, puis build + déploiement du front.
