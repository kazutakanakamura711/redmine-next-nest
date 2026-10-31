'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { UserRound } from 'lucide-react';
import { cn } from 'cn';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Button, buttonVariants } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  TaskStatus,
  TaskStatusDisplayText,
} from '@/features/tasks/types/task-status';
import {
  TaskPriority,
  TaskPriorityDisplayText,
} from '@/features/tasks/types/task-priority';
import type { Task } from '@/features/tasks/types/task';
import { createTask, CreateTaskRequestError } from '../_lib/create-task';
import {
  createTaskFormSchema,
  type CreateTaskFormValues,
} from '../_lib/schema/create-task-form';
import { TaskDateInput } from './task-date-input';

type CreateTaskFormProps = {
  projectId: string;
  reporterName: string | null;
  assignees: { id: string; name: string | null }[];
  disabled?: boolean;
};

function FormSection({
  title,
  disabled,
  className,
  children,
}: {
  title: string;
  disabled: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        'gap-0 rounded-sm border border-border bg-background py-0 ring-0',
        className,
      )}
    >
      <fieldset disabled={disabled} className="min-w-0">
        <legend className="sr-only">{title}</legend>
        <CardHeader className="block px-4 pt-5 sm:px-5">
          <h2 className="text-xs font-semibold text-slate-700">{title}</h2>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pt-4 pb-5 sm:px-5">
          {children}
        </CardContent>
      </fieldset>
    </Card>
  );
}

function FieldLabel({
  htmlFor,
  required = false,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="gap-0.5 text-xs font-normal leading-4 text-slate-700"
    >
      {children}
      {required && (
        <span aria-hidden="true" className="text-red-500">
          *
        </span>
      )}
    </Label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

// itemsにも表示名を渡し、ポップアップを開く前から日本語で表示する。
const statusItems = Object.values(TaskStatus).map((value) => ({
  value,
  label: TaskStatusDisplayText[value],
}));
const priorityItems = Object.values(TaskPriority).map((value) => ({
  value,
  label: TaskPriorityDisplayText[value],
}));

// 入力値の管理・検証と、作成APIへの送信を担当する。
export function CreateTaskForm({
  projectId,
  reporterName,
  assignees,
  disabled = false,
}: CreateTaskFormProps) {
  const router = useRouter();
  const tasksPath = `/projects/${encodeURIComponent(projectId)}/tasks`;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasCreated, setHasCreated] = useState(false);
  // 検証開始から移動までをロックし、再描画前の連打でも同じPOSTを重ねない。
  const submitLock = useRef(false);
  const {
    register,
    handleSubmit,
    // Select・日付入力のような独自UIは、Controller経由でフォームにつなぐ。
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskFormSchema),
    // 初回は送信時に検証し、送信後は入力の修正に合わせてエラーを更新する。
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      status: TaskStatus.Todo,
      priority: TaskPriority.Normal,
      assigneeId: '',
      startDate: null,
      dueDate: null,
    },
  });
  // 作成成功後も、詳細ページへの移動が終わるまでは操作を止める。
  const isBusy = isSubmitting || hasCreated;
  const isDisabled = disabled || isBusy;
  const displayName = reporterName?.trim() || '名前未設定';
  const inputClassName =
    'h-9 rounded-sm border-gray-300 px-3 text-sm placeholder:text-slate-400 md:h-8 md:text-xs';
  const selectTriggerClassName =
    'w-full min-w-0 rounded-sm border-gray-300 bg-background px-3 text-sm text-slate-800 data-[size=default]:h-9 md:text-xs md:data-[size=default]:h-8';
  const assigneeItems = [
    { value: '', label: '担当者を選択' },
    ...assignees.map((assignee) => ({
      value: assignee.id,
      label: assignee.name?.trim() || '名前未設定',
    })),
  ];

  const onSubmit = async (values: CreateTaskFormValues) => {
    setSubmitError(null);

    let task: Task;
    try {
      // APIが受け取る7項目を明示し、未設定の値と日付の形式を揃える。
      task = await createTask(projectId, {
        title: values.title,
        description: values.description || null,
        status: values.status,
        priority: values.priority,
        assigneeId: values.assigneeId || null,
        startDate: values.startDate
          ? format(values.startDate, 'yyyy-MM-dd')
          : null,
        dueDate: values.dueDate ? format(values.dueDate, 'yyyy-MM-dd') : null,
      });
    } catch (error) {
      submitLock.current = false;
      // 同じstatusでも理由が異なるため、APIが返したメッセージを表示する。
      setSubmitError(
        error instanceof CreateTaskRequestError
          ? error.message
          : 'タスクの作成に失敗しました。時間をおいて、もう一度お試しください。',
      );
      return;
    }

    // 保存成功後の移動は、API失敗時の処理と分ける。入力の再送信は許可しない。
    setHasCreated(true);
    router.push(`${tasksPath}/${encodeURIComponent(task.id)}`);
    router.refresh();
  };

  return (
    <form
      noValidate
      aria-label="タスク作成フォーム"
      aria-busy={isBusy}
      onSubmit={(event) => {
        event.preventDefault();
        if (isDisabled || submitLock.current) return;
        submitLock.current = true;
        void handleSubmit(onSubmit, () => {
          // 検証エラーではAPIを呼ばず、修正後の送信を受け付ける。
          submitLock.current = false;
        })(event);
      }}
      className="grid min-w-0 grid-cols-1 items-start gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-3"
    >
      <FormSection
        title="基本情報"
        disabled={isDisabled}
        className="lg:col-span-2"
      >
        <div className="space-y-1.5">
          <FieldLabel htmlFor="task-title" required>
            タイトル
          </FieldLabel>
          <Input
            id="task-title"
            {...register('title')}
            aria-required="true"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'task-title-error' : undefined}
            placeholder="タスクのタイトルを入力"
            className={inputClassName}
          />
          <FieldError id="task-title-error" message={errors.title?.message} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="task-description">説明</FieldLabel>
          <Textarea
            id="task-description"
            {...register('description')}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description ? 'task-description-error' : undefined
            }
            placeholder="タスクの詳細、受け入れ条件、備考などを記載してください"
            className="field-sizing-fixed min-h-60 resize-y rounded-sm border-gray-300 px-3 py-2 text-sm leading-6 placeholder:text-slate-400 md:min-h-40 md:text-xs"
          />
          <FieldError
            id="task-description-error"
            message={errors.description?.message}
          />
        </div>
      </FormSection>

      <div className="min-w-0 space-y-4">
        <FormSection title="属性" disabled={isDisabled}>
          <div className="space-y-1.5">
            <p
              id="task-reporter-label"
              className="text-xs leading-4 text-slate-700"
            >
              報告者
            </p>
            <div
              role="group"
              aria-labelledby="task-reporter-label"
              className="flex min-h-9 min-w-0 items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm md:min-h-8 md:text-xs"
            >
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] text-indigo-600"
              >
                {reporterName?.trim() ? (
                  Array.from(displayName).slice(0, 2).join('')
                ) : (
                  <UserRound className="size-3" />
                )}
              </span>
              <span className="min-w-0 flex-1 wrap-anywhere">
                {displayName}
              </span>
              <span className="shrink-0 text-[11px] text-slate-400">
                自動設定
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="task-status" required>
              ステータス
            </FieldLabel>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select
                  name={field.name}
                  items={statusItems}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                >
                  <SelectTrigger
                    id="task-status"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-required="true"
                    aria-invalid={Boolean(errors.status)}
                    aria-describedby={
                      errors.status ? 'task-status-error' : undefined
                    }
                    className={selectTriggerClassName}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {statusItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              id="task-status-error"
              message={errors.status?.message}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="task-priority" required>
              優先度
            </FieldLabel>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select
                  name={field.name}
                  items={priorityItems}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                >
                  <SelectTrigger
                    id="task-priority"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-required="true"
                    aria-invalid={Boolean(errors.priority)}
                    aria-describedby={
                      errors.priority ? 'task-priority-error' : undefined
                    }
                    className={selectTriggerClassName}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {priorityItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              id="task-priority-error"
              message={errors.priority?.message}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="task-assignee">担当者</FieldLabel>
            <Controller
              name="assigneeId"
              control={control}
              render={({ field }) => (
                <Select
                  name={field.name}
                  items={assigneeItems}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value ?? '')}
                  disabled={isDisabled}
                >
                  <SelectTrigger
                    id="task-assignee"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-invalid={Boolean(errors.assigneeId)}
                    aria-describedby={
                      errors.assigneeId ? 'task-assignee-error' : undefined
                    }
                    className={selectTriggerClassName}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {assigneeItems.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        className="items-start [&>div:first-child]:min-w-0 [&>div:first-child]:shrink [&>div:first-child]:whitespace-normal [&>div:first-child]:wrap-anywhere"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              id="task-assignee-error"
              message={errors.assigneeId?.message}
            />
          </div>
        </FormSection>

        <FormSection title="日程・工数" disabled={isDisabled}>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="task-start-date">開始日</FieldLabel>
            <Controller
              name="startDate"
              control={control}
              // 開始日の変更・クリア時は、その値に依存する期限も再検証する。
              rules={{ deps: ['dueDate'] }}
              render={({ field }) => (
                <TaskDateInput
                  {...field}
                  id="task-start-date"
                  label="開始日"
                  disabled={isDisabled}
                  aria-invalid={Boolean(errors.startDate)}
                  aria-describedby={
                    errors.startDate ? 'task-start-date-error' : undefined
                  }
                  className={inputClassName}
                />
              )}
            />
            <FieldError
              id="task-start-date-error"
              message={errors.startDate?.message}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="task-due-date">期限</FieldLabel>
            <Controller
              name="dueDate"
              control={control}
              render={({ field }) => (
                <TaskDateInput
                  {...field}
                  id="task-due-date"
                  label="期限"
                  disabled={isDisabled}
                  aria-invalid={Boolean(errors.dueDate)}
                  aria-describedby={
                    errors.dueDate ? 'task-due-date-error' : undefined
                  }
                  className={inputClassName}
                />
              )}
            />
            <FieldError
              id="task-due-date-error"
              message={errors.dueDate?.message}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="task-estimated-hours">
              予定工数（時間）
            </FieldLabel>
            {/* 予定工数はデザインの表示のみ。入力管理・API送信は追加しない。 */}
            <Input
              id="task-estimated-hours"
              name="estimatedHours"
              type="number"
              step="0.5"
              placeholder="例: 4.5"
              className={inputClassName}
            />
          </div>
        </FormSection>

        <div className="space-y-2">
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            disabled={isDisabled}
            className="h-9 w-full rounded-sm bg-indigo-600 text-sm text-white hover:bg-indigo-700 md:h-8 md:text-xs"
          >
            {hasCreated
              ? '作成しました'
              : isSubmitting
                ? '作成中...'
                : 'タスクを作成'}
          </Button>
          {isBusy ? (
            <Button
              type="button"
              variant="secondary"
              disabled
              className="h-9 w-full rounded-sm md:h-8 md:text-xs"
            >
              キャンセル
            </Button>
          ) : (
            <Link
              href={tasksPath}
              className={buttonVariants({
                variant: 'secondary',
                className:
                  'h-9 w-full rounded-sm bg-slate-100 text-sm text-slate-700 hover:bg-slate-200 md:h-8 md:text-xs',
              })}
            >
              キャンセル
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
