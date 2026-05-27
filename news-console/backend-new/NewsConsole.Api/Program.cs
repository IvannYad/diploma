using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NewsConsole.BusinessLogic;
using NewsConsole.BusinessLogic.Interfaces;
using NewsConsole.BusinessLogic.Services;
using NewsConsole.BusinessLogic.Startup;
using NewsConsole.Data;
using NewsConsole.Data.Entities;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConfiguration(builder.Configuration.GetSection("Logging"));
builder.Logging.AddConsole();
builder.Logging.AddDebug();

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

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
    var sp = scope.ServiceProvider;

    await DatabaseInitializer.InitializeAsync(
        sp.GetRequiredService<AppDbContext>(),
        sp.GetRequiredService<RoleManager<IdentityRole<int>>>(),
        sp.GetRequiredService<UserManager<AppUser>>(),
        sp.GetRequiredService<EncryptionService>(),
        app.Environment,
        sp.GetRequiredService<IProcessingServerService>());
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
