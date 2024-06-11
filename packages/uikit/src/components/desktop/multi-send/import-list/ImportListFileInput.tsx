import { styled } from 'styled-components';
import { BorderSmallResponsive } from '../../../shared/Styles';
import { Body2, Label2 } from '../../../Text';
import { Button } from '../../../fields/Button';
import { ChangeEvent, DragEvent, FC, useId, useRef, useState } from 'react';
import {
    ListImportError,
    MultiSendList,
    useParseCsvListMutation
} from '../../../../state/multiSend';
import { SpinnerRing } from '../../../Icon';
import { useEventListener } from '../../../../hooks/useEventListener';
import { useAppContext } from '../../../../hooks/appContext';
import { ImportFiatWarningNotification } from './ImportFiatWarningNotification';
import { useDisclosure } from '../../../../hooks/useDisclosure';
import { useMutateUserFiat } from '../../../../state/fiat';

const ImportFileContainer = styled.div`
    width: 100%;
    ${BorderSmallResponsive};
    background: ${p => p.theme.backgroundContent};
    padding: 12px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 200px;
    box-sizing: border-box;
`;

const ImportFileContainerDrop = styled(ImportFileContainer)<{ dropOver: boolean }>`
    border: 1px dashed ${p => (p.dropOver ? p.theme.iconSecondary : p.theme.iconTertiary)};
    transition: border-color 0.15s ease-in-out;

    > ${Body2} {
        transition: color 0.15s ease-in-out;
        color: ${p => (p.dropOver ? p.theme.textPrimary : p.theme.textSecondary)};
    }
`;

const ImportLabel = styled(Label2)`
    margin-bottom: 0.25rem;
`;

const ImportDescription = styled(Body2)`
    color: ${p => p.theme.textSecondary};
    margin-bottom: 1rem;
`;

const FileInput = styled.input`
    display: none;
`;

const ErrorContainer = styled.div`
    margin-top: 1rem;
    color: ${p => p.theme.accentRed};
`;

const SpinnerRingStyled = styled(SpinnerRing)`
    transform: scale(2);
`;

export const ImportListFileInput: FC<{
    onImported: (list: MultiSendList) => void;
    isLoading: boolean;
    className?: string;
}> = ({ onImported, isLoading, className }) => {
    const inputId = useId();
    const {
        mutateAsync,
        isLoading: isParsing,
        error,
        data: mutationData,
        reset
    } = useParseCsvListMutation();
    const [isDragProcess, setIsDragProcess] = useState(false);
    const [isDragOverZone, setIsDragOverZone] = useState(false);
    const [dropError, setDropError] = useState(false);
    const element = useRef(window.document.body);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const { mutateAsync: mutateFiat } = useMutateUserFiat();

    const {
        isOpen: isFiatModalOpen,
        onClose: onFiatModalClose,
        onOpen: onFiatModalOpen
    } = useDisclosure();

    useEventListener(
        'dragenter',
        () => {
            clearTimeout(timeoutRef.current);
            setIsDragProcess(true);
        },
        element
    );
    useEventListener(
        'drop',
        e => {
            e.preventDefault();
            setIsDragProcess(false);
            setIsDragOverZone(false);
        },
        element
    );
    useEventListener(
        'dragleave',
        () => {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setIsDragProcess(false), 110);
        },
        element
    );
    useEventListener(
        'dragover',
        e => {
            e.preventDefault();
            clearTimeout(timeoutRef.current);
            setIsDragProcess(true);
        },
        element
    );

    const { fiat } = useAppContext();

    const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
        onFileUploaded(e.target.files![0]);
    };

    const onFileUploaded = async (file: File) => {
        try {
            const result = await mutateAsync(file);

            if (result.selectedFiat && result.selectedFiat !== fiat) {
                onFiatModalOpen();
            } else {
                onImported(result.list);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const importError = error
        ? error instanceof ListImportError
            ? error
            : new ListImportError('Unknown error', 'unknown')
        : undefined;

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragProcess(false);
        setIsDragOverZone(false);
        const file = e.dataTransfer?.files?.[0];
        if (!file || file.type !== 'text/csv') {
            setDropError(true);
            return;
        }

        onFileUploaded(file);
    };

    if (isDragProcess) {
        return (
            <ImportFileContainerDrop
                onDragEnter={() => setIsDragOverZone(true)}
                onDragOver={e => e.preventDefault()}
                onDragLeave={() => setIsDragOverZone(false)}
                onDrop={onDrop}
                dropOver={isDragOverZone}
                className={className}
            >
                <Body2>Drop the file</Body2>
            </ImportFileContainerDrop>
        );
    }

    const handleCloseFiatModal = async (confirmed?: boolean) => {
        onFiatModalClose();
        if (confirmed) {
            await mutateFiat(mutationData!.selectedFiat!);
            onImported(mutationData!.list);
        } else {
            reset();
        }
    };

    return (
        <ImportFileContainer className={className}>
            {isLoading || isParsing || isFiatModalOpen ? (
                <SpinnerRingStyled />
            ) : (
                <>
                    <ImportLabel>Import .CSV</ImportLabel>
                    <ImportDescription>
                        Drag and drop the file or click the button below to upload it.
                        Please review the example table structure below to avoid errors.
                    </ImportDescription>
                    <Button primary size="small" as="label" htmlFor={inputId}>
                        Upload file
                    </Button>
                    <FileInput id={inputId} type="file" accept=".csv" onChange={onSelect} />
                    {importError && <ErrorContainer>{importError.message}</ErrorContainer>}
                </>
            )}
            <ImportFiatWarningNotification
                isOpen={isFiatModalOpen}
                onClose={handleCloseFiatModal}
                newFiat={mutationData?.selectedFiat}
            />
        </ImportFileContainer>
    );
};
