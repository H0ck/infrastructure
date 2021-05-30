const cdk = require('aws-cdk-lib');
const Infrastructure = require('../lib/infrastructure-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Infrastructure.InfrastructureStack(app, 'MyTestStack');
    // THEN
    const actual = app.synth().getStackArtifact(stack.artifactId).template;
    expect(actual.Resources || {}).toEqual({});
});
