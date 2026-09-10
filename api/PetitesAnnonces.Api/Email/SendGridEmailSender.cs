using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using SendGrid;
using SendGrid.Helpers.Mail;

namespace PetitesAnnonces.Api.Email;

/// <summary>
/// Envoi réel via l'API SendGrid. Utilisé en production, quand une clé d'API est
/// configurée ; sinon <see cref="LoggingEmailSender"/> prend le relais.
/// </summary>
public partial class SendGridEmailSender(IOptions<SendGridOptions> options) : IEmailSender
{
    private readonly SendGridOptions _options = options.Value;

    public async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        var client = new SendGridClient(_options.ApiKey);
        var from = new EmailAddress(_options.FromEmail, _options.FromName);
        var to = new EmailAddress(toEmail);
        var plainTextContent = StripHtmlTags(htmlBody);

        var message = MailHelper.CreateSingleEmail(from, to, subject, plainTextContent, htmlBody);
        var response = await client.SendEmailAsync(message, cancellationToken);

        if ((int)response.StatusCode >= 400)
        {
            var body = await response.Body.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Échec de l'envoi de l'email via SendGrid ({(int)response.StatusCode}) : {body}");
        }
    }

    private static string StripHtmlTags(string html) => HtmlTagRegex().Replace(html, string.Empty);

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex HtmlTagRegex();
}
