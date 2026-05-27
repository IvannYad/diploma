using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using NewsConsole.BusinessLogic.DTOs;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.BusinessLogic.Services;
using NewsConsole.Data;
using NewsConsole.Data.Entities;

namespace NewsConsole.BusinessLogic.Startup;

public static class DatabaseInitializer
{
    public const string DefaultAdminEmail = "test@gmail.com";
    public const string DefaultAdminPassword = "Password123#";

    public static async Task InitializeAsync(
        AppDbContext db,
        RoleManager<IdentityRole<int>> roleManager,
        UserManager<AppUser> userManager,
        EncryptionService encryption,
        IHostEnvironment environment,
        IProcessingServerService processingServerService,
        CancellationToken cancellationToken = default)
    {
        await db.Database.MigrateAsync(cancellationToken);

        foreach (var roleName in new[] { AppRoles.User, AppRoles.Admin })
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new IdentityRole<int>(roleName));
            }
        }

        await EnsureDefaultAdminAsync(userManager, encryption);

        if (environment.IsDevelopment())
        {
            var servers = await processingServerService.GetAllAsync(cancellationToken);
            if (servers.Count == 0)
            {
                await processingServerService.AddAsync(
                    new CreateProcessingServerDto("localhost", 10),
                    cancellationToken);
            }
        }
    }

    private static async Task EnsureDefaultAdminAsync(
        UserManager<AppUser> userManager,
        EncryptionService encryption)
    {
        var user = await userManager.FindByEmailAsync(DefaultAdminEmail);
        if (user is null)
        {
            user = new AppUser
            {
                UserName  = DefaultAdminEmail,
                Email     = DefaultAdminEmail,
                Name      = "Test",
                Surname   = "Admin",
                CreatedAt = DateTime.UtcNow,
            };

            var create = await userManager.CreateAsync(user, DefaultAdminPassword);
            if (!create.Succeeded)
            {
                throw new InvalidOperationException(
                    "Failed to create default admin: "
                    + string.Join("; ", create.Errors.Select(e => e.Description)));
            }

            await userManager.AddToRoleAsync(user, AppRoles.Admin);

            var plainApiKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            user.EncryptedApiKey = encryption.Encrypt(plainApiKey, user.UserName!, user.Id.ToString());
            await userManager.UpdateAsync(user);

            return;
        }

        if (user.IsBlocked)
        {
            user.IsBlocked = false;
            await userManager.UpdateAsync(user);
        }

        var roles = await userManager.GetRolesAsync(user);
        if (!roles.Contains(AppRoles.Admin))
        {
            if (roles.Count > 0)
                await userManager.RemoveFromRolesAsync(user, roles);

            await userManager.AddToRoleAsync(user, AppRoles.Admin);
        }

        if (string.IsNullOrEmpty(user.EncryptedApiKey))
        {
            var plainApiKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            user.EncryptedApiKey = encryption.Encrypt(plainApiKey, user.UserName!, user.Id.ToString());
            await userManager.UpdateAsync(user);
        }
    }
}
