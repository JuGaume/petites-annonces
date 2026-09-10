using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace PetitesAnnonces.Api.Images;

/// <summary>Génère la miniature d'une photo d'annonce à l'upload (voir spec §9, performance).</summary>
public static class ThumbnailGenerator
{
    private const int MaxDimension = 480;
    public const string ThumbnailContentType = "image/jpeg";

    public static async Task<MemoryStream> CreateAsync(Stream source, CancellationToken cancellationToken = default)
    {
        source.Position = 0;
        using var image = await Image.LoadAsync(source, cancellationToken);

        image.Mutate(x => x.Resize(new ResizeOptions
        {
            Mode = ResizeMode.Max,
            Size = new Size(MaxDimension, MaxDimension),
        }));

        var output = new MemoryStream();
        await image.SaveAsync(output, new JpegEncoder { Quality = 80 }, cancellationToken);
        output.Position = 0;
        return output;
    }
}
