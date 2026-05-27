using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.BusinessLogic.Services;
using NewsConsole.Data;
using NewsConsole.Data.Entities;
using NewsConsole.Data.Repositories;

namespace NewsConsole.BusinessLogic;

public static class DependencyInjection
{
    public static IServiceCollection AddBusinessLogic(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddData(configuration);

        var encryptionPassphrase = configuration["Encryption:Passphrase"]
            ?? "default-encryption-passphrase-change-in-production";
        var jwtSecret = configuration["Jwt:Secret"]
            ?? "default-jwt-secret-32-chars-change!";

        var encryption = new EncryptionService(encryptionPassphrase);
        services.AddSingleton(encryption);

        var databaseName = configuration["Mongo:DatabaseName"] ?? "diploma";

        services.AddScoped<IConnectionTestService>(sp =>
            new ConnectionTestService(
                sp.GetRequiredService<IMongoContext>(),
                databaseName,
                sp.GetRequiredService<IProcessingProcessRepository>()));

        services.AddScoped<IImportService, ImportService>();

        services.AddScoped<IAuthService>(sp => new AuthService(
            sp.GetRequiredService<UserManager<AppUser>>(),
            jwtSecret,
            sp.GetRequiredService<EncryptionService>()));

        services.AddScoped<IUserManagementService, UserManagementService>();

        services.AddScoped<IProfileService>(sp => new ProfileService(
            sp.GetRequiredService<UserManager<AppUser>>(),
            sp.GetRequiredService<EncryptionService>()));

        services.AddScoped<IOpenAiKeyResolver, OpenAiKeyResolver>();

        services.AddScoped<IProcessingServerService, ProcessingServerService>();

        services.AddScoped<INewsService, NewsService>();
        services.AddScoped<IChartService, ChartService>();
        services.AddScoped<IIntellectualProcessingSchedulingService, IntellectualProcessingSchedulingService>();
        services.AddScoped<IIntellectualProcessingService, IntellectualProcessingService>();

        return services;
    }
}
