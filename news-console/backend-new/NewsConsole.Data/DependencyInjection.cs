using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NewsConsole.Data.Entities;
using NewsConsole.Data.Repositories;

namespace NewsConsole.Data;

public static class DependencyInjection
{
    public static IServiceCollection AddData(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.AddSingleton<MongoConnectionRegistry>();
        services.AddSingleton<IMongoConnectionRegistry>(sp =>
            sp.GetRequiredService<MongoConnectionRegistry>());

        var databaseName = configuration["Mongo:DatabaseName"] ?? "diploma";
        services.AddScoped<IMongoContext>(sp =>
            new RequestMongoContext(
                sp.GetRequiredService<IMongoConnectionRegistry>(),
                sp.GetRequiredService<IHttpContextAccessor>(),
                databaseName));

        // Repositories are singletons; article cache is keyed per Mongo connection.
        services.AddSingleton<INewsRepository, NewsRepository>();
        services.AddSingleton<IChartRepository, ChartRepository>();
        services.AddScoped<IProcessingProcessRepository, ProcessingProcessRepository>();
        services.AddScoped<IProcessingServerRepository, ProcessingServerRepository>();

        
        var connectionString = configuration.GetConnectionString("Identity")
            ?? "Data Source=identity.db";

        services.AddDbContext<AppDbContext>(opts =>
            opts.UseSqlServer(connectionString));

        services
            .AddIdentityCore<AppUser>(opts =>
            {
                opts.Password.RequiredLength         = 8;
                opts.Password.RequireNonAlphanumeric = false;
                opts.Password.RequireUppercase        = false;
                opts.User.RequireUniqueEmail          = true;
            })
            .AddRoles<IdentityRole<int>>()
            .AddEntityFrameworkStores<AppDbContext>();

        return services;
    }
}
