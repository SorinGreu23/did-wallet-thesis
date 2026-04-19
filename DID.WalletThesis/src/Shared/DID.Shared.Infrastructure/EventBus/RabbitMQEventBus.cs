using System;
using DID.Shared.Application.Interfaces;
using MassTransit;

namespace DID.Shared.Infrastructure.EventBus;

public class RabbitMQEventBus(IPublishEndpoint publishEndpoint) : IEventBus
{
  public async Task PublishAsync<T>(T message, CancellationToken ct = default) where T : class
    => await publishEndpoint.Publish(message, ct);
}
