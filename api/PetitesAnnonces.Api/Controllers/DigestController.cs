using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Notifications;

namespace PetitesAnnonces.Api.Controllers;

/// <summary>Déclenchement manuel du digest quotidien — pratique pour vérifier un envoi réel en dev sans attendre le minuteur.</summary>
[ApiController]
[Route("digest")]
[Authorize(Roles = Roles.Admin)]
public class DigestController(DailyDigestService digestService) : ControllerBase
{
    [HttpPost("run-now")]
    public async Task<IActionResult> RunNow(CancellationToken cancellationToken)
    {
        await digestService.RunOnceAsync(cancellationToken);
        return NoContent();
    }
}
