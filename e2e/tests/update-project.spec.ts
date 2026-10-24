import { randomUUID } from 'node:crypto';

import { expect, test } from '../fixtures/test-user.js';

test('Projectの設定を更新でき、再読み込み後も変更が表示される', async ({
  page,
  testUser,
}) => {
  const projectKey = `PW${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const initialName = `更新前 ${projectKey}`;
  const updatedName = `更新後 ${projectKey}`;
  const initialDescription = '設定を更新する前の説明です。';
  const updatedDescription = 'ブラウザから設定を更新した後の説明です。';

  // 一時ユーザーでログインし、このテスト専用のProjectを作成する。
  await page.goto('/login');
  await page.getByLabel(/^メールアドレス\s*\*?$/).fill(testUser.email);
  await page.getByLabel(/^パスワード\s*\*?$/).fill(testUser.password);
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:3100/projects');

  await page
    .getByRole('button', { name: '新規プロジェクト', exact: true })
    .click();
  await expect(page).toHaveURL('http://localhost:3100/projects/new');
  await page.getByLabel(/^プロジェクト名\s*\*?$/).fill(initialName);
  await page.getByLabel(/^プロジェクトキー\s*\*?$/).fill(projectKey);
  await page.getByLabel('説明', { exact: true }).fill(initialDescription);
  await page
    .getByRole('button', { name: 'プロジェクトを作成', exact: true })
    .click();
  await expect(page).toHaveURL('http://localhost:3100/projects');

  // 一覧から詳細を開き、ownerだけが使える設定の導線へ進む。
  const projectsTable = page.getByRole('table', {
    name: 'プロジェクト一覧',
    exact: true,
  });
  await projectsTable
    .getByRole('link', { name: `${initialName}の詳細を開く`, exact: true })
    .click();
  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/projects\/[^/?]+$/);
  const projectUrl = page.url();

  await page
    .getByRole('navigation', { name: 'プロジェクト詳細', exact: true })
    .getByRole('link', { name: '設定', exact: true })
    .click();
  await expect(page).toHaveURL(`${projectUrl}?tab=setting`);

  const nameInput = page.getByLabel(/^プロジェクト名\s*\*?$/);
  const descriptionInput = page.getByLabel('説明', { exact: true });
  const keyInput = page.getByLabel('プロジェクトキー', { exact: true });
  await expect(nameInput).toHaveValue(initialName);
  await expect(descriptionInput).toHaveValue(initialDescription);
  await expect(keyInput).toHaveValue(projectKey);

  await nameInput.fill(updatedName);
  await descriptionInput.fill(updatedDescription);
  await page.getByRole('button', { name: '設定を保存', exact: true }).click();

  // 入力欄だけでなく、再取得したヘッダー・パンくず・サイドバーを確認する。
  const heading = page.getByRole('heading', { name: updatedName, exact: true });
  const breadcrumb = page.getByRole('navigation', {
    name: 'breadcrumb',
    exact: true,
  });
  const currentBreadcrumb = breadcrumb.getByRole('link', {
    name: updatedName,
    exact: true,
  });
  const sidebarProject = page
    .getByRole('complementary')
    .getByRole('link', { name: updatedName });

  await expect(heading).toBeVisible();
  await expect(currentBreadcrumb).toBeVisible();
  await expect(sidebarProject).toBeVisible();
  await expect(sidebarProject).toContainText(projectKey);
  await expect(page).toHaveURL(`${projectUrl}?tab=setting`);

  // 再読み込み後も、設定URLと保存したフォーム値・各表示が残ることを確認する。
  await page.reload();

  await expect(page).toHaveURL(`${projectUrl}?tab=setting`);
  await expect(nameInput).toHaveValue(updatedName);
  await expect(descriptionInput).toHaveValue(updatedDescription);
  await expect(keyInput).toHaveValue(projectKey);
  await expect(heading).toBeVisible();
  await expect(currentBreadcrumb).toBeVisible();
  await expect(sidebarProject).toBeVisible();

  // パンくずから一覧へ戻り、保存した名前・キー・説明を確認する。
  await breadcrumb
    .getByRole('link', { name: 'プロジェクト一覧', exact: true })
    .click();
  await expect(page).toHaveURL('http://localhost:3100/projects');
  const projectRow = projectsTable.getByRole('link', {
    name: `${updatedName}の詳細を開く`,
    exact: true,
  });
  await expect(projectRow).toBeVisible();
  await expect(projectRow).toContainText(updatedName);
  await expect(projectRow).toContainText(projectKey);
  await expect(projectRow).toContainText(updatedDescription);

  await page.reload();

  await expect(projectRow).toBeVisible();
  await expect(projectRow).toContainText(updatedName);
  await expect(projectRow).toContainText(projectKey);
  await expect(projectRow).toContainText(updatedDescription);
  await expect(sidebarProject).toBeVisible();
});
