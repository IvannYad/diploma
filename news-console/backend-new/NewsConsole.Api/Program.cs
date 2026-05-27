using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NewsConsole.BusinessLogic;
using NewsConsole.Data;
using NewsConsole.Data.Entities;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConfiguration(builder.Configuration.GetSection("Logging"));
builder.Logging.AddConsole();
builder.Logging.AddDebug();

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

// JWT authentication (used by [Authorize] endpoints; does not break unprotected routes).
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "default-jwt-secret-32-chars-change!";
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = false,
            ValidateAudience         = false,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(
                                           Encoding.UTF8.GetBytes(jwtSecret)),
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy        = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DefaultIgnoreCondition      = JsonIgnoreCondition.WhenWritingNull;
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
    });

builder.Services.AddBusinessLogic(builder.Configuration);

var app = builder.Build();


using (var scope = app.Services.CreateScope())
{
    var db          = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<int>>>();

    await db.Database.MigrateAsync();

    foreach (var roleName in new[] { AppRoles.User, AppRoles.Admin })
    {
        if (!await roleManager.RoleExistsAsync(roleName))
            await roleManager.CreateAsync(new IdentityRole<int>(roleName));
    }

    if (app.Environment.IsDevelopment())
    {
        var serverService = scope.ServiceProvider.GetRequiredService<NewsConsole.BusinessLogic.Interfaces.IProcessingServerService>();
        var servers = await serverService.GetAllAsync();
        if (servers.Count == 0)
        {
            await serverService.AddAsync(
                new NewsConsole.BusinessLogic.DTOs.CreateProcessingServerDto("localhost", 10));
        }
    }
}

app.Use(async (context, next) =>
{
    var logger = context.RequestServices
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("NewsConsole.Api.Request");

    var startedAt = DateTime.UtcNow;
    logger.LogTrace(
        "Request started {Method} {Path}{QueryString}",
        context.Request.Method,
        context.Request.Path,
        context.Request.QueryString.Value
    );

    try
    {
        await next();

        var elapsedMs = (DateTime.UtcNow - startedAt).TotalMilliseconds;
        var status = context.Response.StatusCode;

        if (status >= 500)
        {
            logger.LogError(
                "Request completed {Method} {Path} -> {StatusCode} in {ElapsedMs} ms",
                context.Request.Method,
                context.Request.Path,
                status,
                elapsedMs
            );
        }
        else if (status >= 400)
        {
            logger.LogWarning(
                "Request completed {Method} {Path} -> {StatusCode} in {ElapsedMs} ms",
                context.Request.Method,
                context.Request.Path,
                status,
                elapsedMs
            );
        }
        else
        {
            logger.LogInformation(
                "Request completed {Method} {Path} -> {StatusCode} in {ElapsedMs} ms",
                context.Request.Method,
                context.Request.Path,
                status,
                elapsedMs
            );
        }
    }
    catch (Exception ex)
    {
        var elapsedMs = (DateTime.UtcNow - startedAt).TotalMilliseconds;
        logger.LogError(
            ex,
            "Unhandled exception for {Method} {Path} after {ElapsedMs} ms",
            context.Request.Method,
            context.Request.Path,
            elapsedMs
        );
        throw;
    }
});

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
