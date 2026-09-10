using FluentValidation;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Validation;

/// <summary>Règles métier de dépôt d'annonce (spec §8 : validation stricte, contrôle serveur des photos).</summary>
public class CreateListingRequestValidator : AbstractValidator<CreateListingRequest>
{
    public const int MaxImages = 8;
    public const long MaxImageBytes = 5 * 1024 * 1024;
    public static readonly string[] AllowedImageContentTypes = ["image/jpeg", "image/png", "image/webp"];

    public CreateListingRequestValidator(ApplicationDbContext db)
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.Mode).IsInEnum();
        RuleFor(x => x.ContactMode).IsInEnum();

        RuleFor(x => x.CategoryId)
            .MustAsync((categoryId, cancellationToken) => db.Categories.AnyAsync(c => c.Id == categoryId, cancellationToken))
            .WithMessage("Catégorie inconnue.");

        RuleFor(x => x.Price)
            .NotNull()
            .WithMessage("Le prix est requis pour une vente.")
            .GreaterThanOrEqualTo(0)
            .WithMessage("Le prix ne peut pas être négatif.")
            .When(x => x.Mode == ListingMode.Sale);
        RuleFor(x => x.Price)
            .Null()
            .WithMessage("Le prix ne s'applique pas à un don ou un troc.")
            .When(x => x.Mode != ListingMode.Sale);

        RuleFor(x => x.ContactDetails)
            .NotEmpty()
            .WithMessage("Les coordonnées sont requises pour un contact direct.")
            .When(x => x.ContactMode == ContactMode.DirectContact);

        RuleFor(x => x.Images)
            .Must(images => images.Count <= MaxImages)
            .WithMessage($"Maximum {MaxImages} photos par annonce.");

        RuleForEach(x => x.Images).ChildRules(image =>
        {
            image.RuleFor(i => i.ContentType)
                .Must(contentType => AllowedImageContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
                .WithMessage("Type de fichier non autorisé (jpeg, png ou webp uniquement).");

            image.RuleFor(i => i.Length)
                .LessThanOrEqualTo(MaxImageBytes)
                .WithMessage("Chaque photo doit faire moins de 5 Mo.");
        });
    }
}
